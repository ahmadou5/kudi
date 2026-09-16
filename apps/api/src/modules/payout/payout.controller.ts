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

const DAILY_LIMITS_NGN = {
  [KYCTier.UNVERIFIED]: 0,
  [KYCTier.TIER_1]: 50000,
  [KYCTier.TIER_2]: 5000000
};

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
    const dailyLimitNGN = DAILY_LIMITS_NGN[tier];
    const amountNGN = Math.floor(amountUSDC * currentRate);

    if (amountNGN > dailyLimitNGN && dailyLimitNGN > 0) {
      return reply.status(403).send(
        errorResponse(
          'DAILY_LIMIT_EXCEEDED',
          `Transaction amount ₦${amountNGN.toLocaleString()} NGN exceeds your ${tier} daily limit of ₦${dailyLimitNGN.toLocaleString()} NGN.`,
          403
        )
      );
    }

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
        }
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('INSUFFICIENT_BALANCE:')) {
        const available = Number(message.split(':')[1] || 0);
        return reply
          .status(400)
          .send(errorResponse('INSUFFICIENT_BALANCE', `Requested spend ${amountUSDC} USDC exceeds balance ${available} USDC`));
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
          toUserId: recipient.id
        }
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

    // 6. Create withdrawal record + optimistic debit (atomic in-process)
    const reference = generateReference('KUDI_ONCHAIN');
    let withdrawal;
    try {
      withdrawal = await this.ledgerService.createWithdrawal({
        reference,
        userId,
        amountUSDC: numAmountUSDC,
        toAddress,
        chain
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('INSUFFICIENT_BALANCE:')) {
        const available = Number(message.split(':')[1] || 0);
        return reply.status(400).send(
          errorResponse('INSUFFICIENT_BALANCE', `Insufficient balance. Available: ${available.toFixed(2)} USDC`, 400)
        );
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
}

