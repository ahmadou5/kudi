import { FastifyReply, FastifyRequest } from 'fastify';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { ReceiptGenerator } from '@kudi/receipts';
import { KYCTier, WithdrawalStatus } from '@kudi/types';
import { validateCryptoAddress } from '@kudi/chains-core';
import { LedgerService } from '../../services/ledgerService';
import { RateService } from '../../services/rateService';
import { errorResponse, successResponse } from '../../utils/response';
import { verifyPin, generateReference } from '../../utils/hash';
import { getAuthenticatedUser } from '../../utils/authGuards';
import { buildDailyLimitCheck, formatDailyLimitMessage, parseDailyLimitError } from '../../utils/dailyLimits';
import { SolanaListener } from '@kudi/chains';
import { SelfCustodyProvider, resolveGasPaymentMode } from '@kudi/chains';
import { prisma } from '@kudi/database';
import { apiConfig } from '@kudi/config';

export class PayoutController {
  constructor(
    private paymentRegistry: PaymentProviderRegistry,
    private ledgerService: LedgerService,
    private rateService: RateService
  ) {}

  public resolveAccount = async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountNumber, bankCode } = request.body as { accountNumber: string; bankCode: string };
    const activeProvider = this.paymentRegistry.getActiveProvider();
    const resolution = await activeProvider.resolveAccount(accountNumber, bankCode);
    return successResponse(resolution);
  };

  public listBanks = async (request: FastifyRequest, reply: FastifyReply) => {
    const activeProvider = this.paymentRegistry.getActiveProvider();
    const banks = await activeProvider.listSupportedBanks();
    return successResponse({ provider: activeProvider.id, banks });
  };

  public spendToBank = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const { pin, amountUSDC, bankCode, accountNumber, accountName, narration } = request.body as {
      userId?: string;
      pin?: string;
      amountUSDC: number;
      bankCode: string;
      accountNumber: string;
      accountName: string;
      narration?: string;
    };

    const userId = authUser?.userId;
    if (!userId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication is required', 401));
    }
    const user = this.ledgerService.getUser(userId);
    if (!verifyPin(pin || '', user?.pinHash)) {
      return reply.status(401).send(errorResponse('INVALID_PIN', 'Incorrect transaction PIN entered', 401));
    }

    const currentRate = this.rateService.getCurrentRate();
    const tier = user?.kycTier || KYCTier.UNVERIFIED;
    const dailyLimit = { ...buildDailyLimitCheck(tier, amountUSDC, currentRate), sourceType: 'BANK_PAYOUT' };
    const amountNGN = dailyLimit.amountNGN;

    const reference = generateReference('KUDI_SPEND');
    let newBalance: number;
    try {
      newBalance = await this.ledgerService.debitBalanceAtomic({
        userId,
        amountUSDC,
        reference,
        type: 'SPEND_DEBIT',
        metadata: {
          title: 'Bank Payout',
          subtitle: `${accountName || 'Bank Transfer'} (${accountNumber || ''})`,
          amountNGN,
          exchangeRateNGN: currentRate,
          recipientBankCode: bankCode
        },
        dailyLimit
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('INSUFFICIENT_BALANCE:')) {
        const available = Number(message.split(':')[1] || 0);
        return reply
          .status(400)
          .send(errorResponse('INSUFFICIENT_BALANCE', `Requested spend ${amountUSDC} USDC exceeds balance ${available} USDC`));
      }
      const limitError = parseDailyLimitError(message);
      if (limitError) {
        return reply.status(403).send(errorResponse(
          'DAILY_LIMIT_EXCEEDED',
          formatDailyLimitMessage(limitError.amountNGN, limitError.spentTodayNGN, limitError.limitNGN, tier),
          403
        ));
      }
      return reply.status(500).send(errorResponse('BALANCE_DEBIT_FAILED', message, 500));
    }

    try {
      const transferRes = await this.paymentRegistry.initiateTransferWithFailover({
        reference,
        amountNGN,
        bankCode,
        accountNumber,
        accountName,
        narration
      });

      const spendRecord = {
        reference,
        userId,
        amountUSDC: amountUSDC.toFixed(2),
        exchangeRateNGN: currentRate,
        amountNGN,
        recipientBankCode: bankCode,
        recipientAccountNumber: accountNumber,
        recipientAccountName: accountName,
        payoutProvider: transferRes.provider,
        status: transferRes.status,
        timestamp: new Date().toISOString()
      };

      this.ledgerService.recordSpend(reference, spendRecord);

      return successResponse({
        ...spendRecord,
        newBalanceUSDC: newBalance.toFixed(2)
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.ledgerService.releaseSpendLimitEntry(reference, 'PAYOUT_FAILED');
      await this.ledgerService.creditBalanceAtomic({
        userId,
        amountUSDC,
        reference: `rev_${reference}`,
        type: 'DEPOSIT_CREDIT',
        metadata: {
          reference,
          reason: 'PAYOUT_FAILED',
          type: 'SPEND_REVERSAL',
          title: 'Bank Payout Reversal',
          subtitle: 'Restored to Balance'
        }
      });
      return reply
        .status(500)
        .send(errorResponse('PAYOUT_FAILED_REVERSED', `Payout failed: ${errorMessage}. Balance has been restored.`, 500));
    }
  };

  public spendToUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const { toHandle, amountUSDC, pin } = request.body as {
      fromUserId?: string;
      toHandle: string;
      amountUSDC: number;
      pin?: string;
    };

    const fromUserId = authUser?.userId;
    if (!fromUserId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication is required', 401));
    }
    const sender = this.ledgerService.getUser(fromUserId);
    if (!verifyPin(pin || '', sender?.pinHash)) {
      return reply.status(401).send(errorResponse('INVALID_PIN', 'Incorrect transaction PIN entered', 401));
    }

    // Resolve recipient
    let recipient = this.ledgerService.findUserByPrivyOrEmail(toHandle, toHandle, toHandle);
    if (!recipient) {
      // Find by ID prefix or create recipient user for demo
      recipient = this.ledgerService.getUser(toHandle) || this.ledgerService.registerUser(`usr_handle_${toHandle}`, undefined, `${toHandle}@kudi.app`);
    }

    const transferRate = this.rateService.getCurrentRate();
    const transferTier = sender?.kycTier || KYCTier.UNVERIFIED;
    const transferDailyLimit = { ...buildDailyLimitCheck(transferTier, amountUSDC, transferRate), sourceType: 'INTER_APP_TRANSFER' };
    const reference = generateReference('KUDI_TRANSFER');
    let newSenderBalance: number;
    try {
      newSenderBalance = await this.ledgerService.debitBalanceAtomic({
        userId: fromUserId,
        amountUSDC,
        reference,
        type: 'SPEND_DEBIT',
        metadata: {
          title: `Transfer to ${toHandle}`,
          subtitle: 'Kudi Inter-App Transfer',
          toUserId: recipient.id,
          amountNGN: transferDailyLimit.amountNGN,
          exchangeRateNGN: transferRate
        },
        dailyLimit: transferDailyLimit
      });
      await this.ledgerService.creditBalanceAtomic({
        userId: recipient.id,
        amountUSDC,
        reference: `rec_${reference}`,
        type: 'DEPOSIT_CREDIT',
        metadata: {
          title: 'Inter-App Transfer Received',
          subtitle: 'Kudi Transfer',
          fromUserId
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('INSUFFICIENT_BALANCE:')) {
        const available = Number(message.split(':')[1] || 0);
        return reply.status(400).send(errorResponse('INSUFFICIENT_BALANCE', `Insufficient balance. Available: ${available} USDC`));
      }
      const limitError = parseDailyLimitError(message);
      if (limitError) {
        return reply.status(403).send(errorResponse(
          'DAILY_LIMIT_EXCEEDED',
          formatDailyLimitMessage(limitError.amountNGN, limitError.spentTodayNGN, limitError.limitNGN, transferTier),
          403
        ));
      }
      return reply.status(500).send(errorResponse('TRANSFER_FAILED', message, 500));
    }

    this.ledgerService.recordTransaction({
      fromUserId,
      toUserId: recipient.id,
      amount: amountUSDC.toFixed(2),
      currency: 'USDC',
      reference,
      timestamp: new Date().toISOString(),
      metadata: {
        title: `Transfer to ${toHandle}`,
        subtitle: 'Kudi Inter-App Transfer',
        type: 'SPEND_INTER_APP'
      }
    });

    return successResponse({
      reference,
      recipientId: recipient.id,
      amountUSDC: amountUSDC.toFixed(2),
      newBalanceUSDC: newSenderBalance.toFixed(2)
    }, 'Inter-app transfer successful');
  };

  public spendOnChain = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const { pin, amountUSDC, toAddress, chain } = request.body as {
      userId?: string;
      pin?: string;
      amountUSDC: number | string;
      toAddress: string;
      chain: 'solana' | 'monad';
    };

    const numAmountUSDC = typeof amountUSDC === 'number' ? amountUSDC : parseFloat(String(amountUSDC || 0)) || 0;

    // 1. PIN verification
    const userId = authUser?.userId;
    if (!userId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication is required', 401));
    }
    const user = this.ledgerService.getUser(userId);
    if (!verifyPin(pin || '', user?.pinHash)) {
      return reply.status(401).send(errorResponse('INVALID_PIN', 'Incorrect transaction PIN entered', 401));
    }

    // 2. Address format validation — before any funds move
    if (!validateCryptoAddress(toAddress, chain)) {
      return reply.status(400).send(
        errorResponse('INVALID_ADDRESS', `The address "${toAddress}" is not a valid ${chain} address.`, 400)
      );
    }

    // 3. Minimum send guard
    if (numAmountUSDC < 1.0) {
      return reply.status(400).send(
        errorResponse('BELOW_MINIMUM', 'Minimum crypto send is 1.00 USDC.', 400)
      );
    }

    // 4. Self-send guard — block sending to own deposit address
    const userWallets = this.ledgerService.getUserWallets(userId) || [];
    const isSelfSend = userWallets.some((w) => w.address.toLowerCase() === toAddress.toLowerCase());
    if (isSelfSend) {
      return reply.status(400).send(
        errorResponse('SELF_SEND_BLOCKED', 'You cannot send crypto to your own Kudi deposit address.', 400)
      );
    }

    // 6. Create withdrawal record + optimistic debit.
    const withdrawalRate = this.rateService.getCurrentRate();
    const withdrawalTier = user?.kycTier || KYCTier.UNVERIFIED;
    const withdrawalDailyLimit = { ...buildDailyLimitCheck(withdrawalTier, numAmountUSDC, withdrawalRate), sourceType: 'ONCHAIN_SEND' };
    const reference = generateReference('KUDI_ONCHAIN');
    let withdrawal;
    try {
      withdrawal = await this.ledgerService.createWithdrawal({
        reference,
        userId,
        amountUSDC: numAmountUSDC,
        toAddress,
        chain,
        dailyLimit: withdrawalDailyLimit
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('INSUFFICIENT_BALANCE:')) {
        const available = Number(message.split(':')[1] || 0);
        return reply.status(400).send(
          errorResponse('INSUFFICIENT_BALANCE', `Insufficient balance. Available: ${available.toFixed(2)} USDC`, 400)
        );
      }
      const limitError = parseDailyLimitError(message);
      if (limitError) {
        return reply.status(403).send(errorResponse(
          'DAILY_LIMIT_EXCEEDED',
          formatDailyLimitMessage(limitError.amountNGN, limitError.spentTodayNGN, limitError.limitNGN, withdrawalTier),
          403
        ));
      }
      return reply.status(500).send(errorResponse('WITHDRAWAL_CREATE_FAILED', message, 500));
    }

    // 7. Worker picks up the durable DB withdrawal record asynchronously.
    console.log(`[PayoutController] 📤 Crypto withdrawal persisted: ${reference} | ${numAmountUSDC} USDC → ${toAddress.slice(0, 8)}... on ${chain}`);

    return successResponse({
      reference: withdrawal.reference,
      status: WithdrawalStatus.PENDING,
      chain,
      toAddress,
      amountUSDC: numAmountUSDC.toFixed(2),
      newBalanceUSDC: (await this.ledgerService.getBalanceAsync(userId)).toFixed(2),
      message: 'Your crypto send is being broadcast to the network. Check status using the reference.'
    }, 'Crypto send initiated');
  };

  public getCryptoWithdrawalStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { reference } = request.params as { reference: string };
    const withdrawal = await this.ledgerService.getWithdrawalAsync(reference);
    if (!withdrawal) {
      return reply.status(404).send(errorResponse('NOT_FOUND', `No withdrawal found for reference: ${reference}`, 404));
    }
    return successResponse(withdrawal);
  };

  public getReceipt = async (request: FastifyRequest, reply: FastifyReply) => {
    const { reference } = request.params as { reference: string };
    const spend = this.ledgerService.getSpend(reference);
    if (!spend) {
      return reply.status(404).send(errorResponse('NOT_FOUND', 'Receipt not found', 404));
    }

    const html = ReceiptGenerator.generateHTML({
      reference: spend.reference,
      timestamp: spend.timestamp,
      amountUSDC: spend.amountUSDC,
      exchangeRateNGN: spend.exchangeRateNGN,
      amountNGN: spend.amountNGN,
      feeNGN: 0,
      recipientBank: spend.recipientBankCode === '058' ? 'GTBank' : spend.recipientBankCode,
      recipientAccountNumber: spend.recipientAccountNumber,
      recipientAccountName: spend.recipientAccountName,
      payoutProvider: spend.payoutProvider,
      status: spend.status
    });

    return reply.type('text/html').send(html);
  };

  public cashout = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const body = request.body as {
      userId?: string;
      pin?: string;
      amountUSDC: number;
      walletAddress: string;
      type: 'CRYPTO' | 'NGN_PAYOUT';
      bankCode?: string;
      accountNumber?: string;
      accountName?: string;
      payoutProvider?: 'paystack' | 'monnify' | 'squad';
    };

    const userId = authUser?.userId;
    if (!userId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication is required', 401));
    }

    if (!body.amountUSDC || body.amountUSDC < 0.1) {
      return reply.status(400).send(errorResponse('INVALID_AMOUNT', 'Minimum cashout amount is 0.1 USDC', 400));
    }

    if (body.type === 'NGN_PAYOUT' && (!body.bankCode || !body.accountNumber || !body.accountName)) {
      return reply.status(400).send(errorResponse('INVALID_PAYOUT_DETAILS', 'Bank code, account number, and account name are required for NGN payout', 400));
    }

    const user = this.ledgerService.getUser(userId);
    if (!user) {
      return reply.status(404).send(errorResponse('USER_NOT_FOUND', 'User not found', 404));
    }

    if (!verifyPin(body.pin || '', user.pinHash)) {
      return reply.status(401).send(errorResponse('INVALID_PIN', 'Incorrect transaction PIN', 401));
    }

    // Verify wallet ownership
    const userWallets = this.ledgerService.getUserWallets(userId) || [];
    const wallet = userWallets.find(w => w.address.toLowerCase() === body.walletAddress.toLowerCase());
    if (!wallet) {
      return reply.status(400).send(errorResponse('WALLET_NOT_FOUND', 'Deposit wallet not found for user', 400));
    }

    const privyWalletId = wallet.privyWalletId || (wallet.metadata?.privyWalletId as string | undefined);
    if (!privyWalletId) {
      return reply.status(400).send(errorResponse('SELF_CUSTODY', 'Cannot cashout from self-custody wallet. Use external wallet.', 400));
    }

    // Check on-chain balance
    const chain = wallet.chain === 'solana' ? 'solana' : 'monad';
    const listener = new SolanaListener({
      rpcUrl: apiConfig.SOLANA_RPC_URL,
      rpcUrlFallback: apiConfig.SOLANA_RPC_URL_FALLBACK,
      usdcMintAddress: apiConfig.USDC_MINT_ADDRESS
    });
    const tokenAddress = chain === 'solana'
      ? apiConfig.USDC_MINT_ADDRESS
      : apiConfig.AUSD_TOKEN_ADDRESS;
    const onChainBalance = await listener.getSolanaUSDCBalance(body.walletAddress);
    
    // Note: For Monad, we'd need EVM balance check - using placeholder for now
    const availableUSDC = chain === 'solana' ? onChainBalance : Number.MAX_SAFE_INTEGER;
    if (availableUSDC < body.amountUSDC) {
      return reply.status(400).send(errorResponse('INSUFFICIENT_BALANCE', `On-chain balance insufficient. Available: ${availableUSDC} USDC`, 400));
    }

    const reference = generateReference('KUDI_CASHOUT');
    const gasMode = apiConfig.GAS_PAYMENT_MODE || 'PRIVY_SPONSOR';
    const selfCustody = new SelfCustodyProvider();

    try {
      const treasuryAddress = chain === 'solana' ? apiConfig.KUDI_TREASURY_SOLANA_ADDRESS : apiConfig.KUDI_TREASURY_EVM_ADDRESS;
      if (!treasuryAddress) {
        return reply.status(500).send(errorResponse('CONFIG_ERROR', 'Treasury address not configured', 500));
      }

      // Build and send USDC transfer from deposit wallet to treasury
      const { txHash } = await selfCustody.sendCrypto({
        treasuryWalletId: privyWalletId,
        depositWalletId: body.walletAddress,
        toAddress: treasuryAddress,
        amountUSDC: body.amountUSDC,
        chain: chain as 'solana' | 'monad',
        gasPaymentMode: (gasMode === 'TREASURY_FEE_PAYER' ? 'TREASURY_FEE_PAYER' : 'PRIVY_SPONSOR'),
        idempotencyKey: reference,
        feeUSDC: apiConfig.USDC_FEE,
        feePayerAddress: treasuryAddress // NEW: treasury pays fees
      });

      // Wait for confirmation
      const confirmed = await selfCustody.waitForConfirmation(txHash, chain);
      if (!confirmed) {
        throw new Error(`Cashout transaction not confirmed: ${txHash}`);
      }

      // Deduct from user's USDC balance (amount + estimated gas for TREASURY_FEE_PAYER)
      const gasEstimateUSDC = gasMode === 'TREASURY_FEE_PAYER' ? 0.001 : 0;
      const totalDebitUSDC = body.amountUSDC + gasEstimateUSDC;
      
      await this.ledgerService.debitBalanceAtomic({
        userId,
        amountUSDC: totalDebitUSDC,
        reference,
        type: 'CASHOUT_CRYPTO',
        metadata: {
          chain,
          walletAddress: body.walletAddress,
          txHash,
          title: 'Cashout to Treasury',
          subtitle: `${chain.toUpperCase()} Network`,
          status: 'CONFIRMED'
        }
      });

      // Create cashout record in Deposit table
      await prisma.$executeRaw`
        INSERT INTO "Deposit" (id, "userId", "walletAddress", chain, "tokenSymbol", "amountUSDC", signature, "creditStatus", "cashOutType", "cashOutStatus", "cashOutTxHash", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          ${body.walletAddress},
          ${chain},
          ${wallet.chain === 'solana' ? 'USDC' : 'AUSD'},
          ${body.amountUSDC},
          ${txHash},
          'CREDITED',
          ${body.type},
          'CONFIRMED',
          ${txHash},
          NOW(),
          NOW()
        )
      `;

      let payoutTxId: string | undefined;
      let payoutProvider: string | undefined;

      if (body.type === 'NGN_PAYOUT') {
        // Convert USDC to NGN
        const rate = this.rateService.getCurrentRate();
        const amountNGN = Math.floor(body.amountUSDC * rate);
        const feeNGN = 20; // ₦20 flat fee
        const netAmountNGN = amountNGN - feeNGN;

        // Use existing payout provider failover
        const transferRes = await this.paymentRegistry.initiateTransferWithFailover({
          amountNGN: netAmountNGN,
          bankCode: body.bankCode!,
          accountNumber: body.accountNumber!,
          accountName: body.accountName!,
          narration: `Cashout ${body.amountUSDC} USDC`,
          reference: `CASHOUT_${reference}`
        });

        payoutTxId = transferRes.reference;
        payoutProvider = transferRes.provider;

        // Create SpendTransaction record
        this.ledgerService.recordSpend(`CASHOUT_${reference}`, {
          reference: `CASHOUT_${reference}`,
          userId,
          amountUSDC: body.amountUSDC,
          exchangeRateNGN: rate,
          amountNGN: netAmountNGN,
          feeNGN,
          recipientBankCode: body.bankCode!,
          recipientAccountNumber: body.accountNumber!,
          recipientAccountName: body.accountName!,
          payoutProvider: transferRes.provider,
          status: 'PENDING'
        });
      }

      const newBalance = await this.ledgerService.getBalanceAsync(userId);

      return successResponse({
        reference,
        status: 'CONFIRMED',
        cashOutTxHash: txHash,
        payoutTxId,
        newBalanceUSDC: newBalance.toFixed(2),
        amountUSDC: body.amountUSDC
      }, 'Cashout completed successfully');

    } catch (err: any) {
      console.error('[PayoutController] Cashout failed:', err);
      
      // Record failed cashout
      await prisma.$executeRaw`
        INSERT INTO "Deposit" (id, "userId", "walletAddress", chain, "tokenSymbol", "amountUSDC", signature, "creditStatus", "cashOutType", "cashOutStatus", "cashOutTxHash", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${userId},
          ${body.walletAddress},
          ${chain},
          ${wallet.chain === 'solana' ? 'USDC' : 'AUSD'},
          ${body.amountUSDC},
          ${reference},
          'CREDITED',
          ${body.type},
          'FAILED',
          NULL,
          NOW(),
          NOW()
        )
      `;

      return reply.status(500).send(errorResponse('CASHOUT_FAILED', err.message || 'Cashout failed', 500));
    }
  };
}

