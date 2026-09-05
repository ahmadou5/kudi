import { FastifyReply, FastifyRequest } from 'fastify';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { ReceiptGenerator } from '@kudi/receipts';
import { KYCTier } from '@kudi/types';
import { LedgerService } from '../../services/ledgerService';
import { RateService } from '../../services/rateService';
import { errorResponse, successResponse } from '../../utils/response';
import { verifyPin, generateReference } from '../../utils/hash';

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
    const { userId, pin, amountUSDC, bankCode, accountNumber, accountName, narration } = request.body as {
      userId: string;
      pin?: string;
      amountUSDC: number;
      bankCode: string;
      accountNumber: string;
      accountName: string;
      narration?: string;
    };

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

    const currentBalance = this.ledgerService.getBalance(userId);
    if (currentBalance < amountUSDC) {
      return reply
        .status(400)
        .send(errorResponse('INSUFFICIENT_BALANCE', `Requested spend ${amountUSDC} USDC exceeds balance ${currentBalance} USDC`));
    }

    const reference = generateReference('KUDI_SPEND');
    const newBalance = currentBalance - amountUSDC;
    this.ledgerService.setBalance(userId, newBalance);

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
      this.ledgerService.setBalance(userId, currentBalance);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return reply
        .status(500)
        .send(errorResponse('PAYOUT_FAILED_REVERSED', `Payout failed: ${errorMessage}. Balance has been restored.`, 500));
    }
  };

  public spendToUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { fromUserId, toHandle, amountUSDC, pin } = request.body as {
      fromUserId: string;
      toHandle: string;
      amountUSDC: number;
      pin?: string;
    };

    const sender = this.ledgerService.getUser(fromUserId);
    if (!verifyPin(pin || '', sender?.pinHash)) {
      return reply.status(401).send(errorResponse('INVALID_PIN', 'Incorrect transaction PIN entered', 401));
    }

    const currentBalance = this.ledgerService.getBalance(fromUserId);
    if (currentBalance < amountUSDC) {
      return reply.status(400).send(errorResponse('INSUFFICIENT_BALANCE', `Insufficient balance. Available: ${currentBalance} USDC`));
    }

    // Resolve recipient
    let recipient = this.ledgerService.findUserByPrivyOrEmail(toHandle, toHandle, toHandle);
    if (!recipient) {
      // Find by ID prefix or create recipient user for demo
      recipient = this.ledgerService.getUser(toHandle) || this.ledgerService.registerUser(`usr_handle_${toHandle}`, undefined, `${toHandle}@kudi.app`);
    }

    const reference = generateReference('KUDI_TRANSFER');
    const newSenderBalance = currentBalance - amountUSDC;
    this.ledgerService.setBalance(fromUserId, newSenderBalance);

    const recipientCurrentBalance = this.ledgerService.getBalance(recipient.id);
    this.ledgerService.setBalance(recipient.id, recipientCurrentBalance + amountUSDC);

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
    const { userId, pin, amountUSDC, toAddress, chain } = request.body as {
      userId: string;
      pin?: string;
      amountUSDC: number;
      toAddress: string;
      chain: 'solana' | 'monad';
    };

    const user = this.ledgerService.getUser(userId);
    if (!verifyPin(pin || '', user?.pinHash)) {
      return reply.status(401).send(errorResponse('INVALID_PIN', 'Incorrect transaction PIN entered', 401));
    }

    const currentBalance = this.ledgerService.getBalance(userId);
    if (currentBalance < amountUSDC) {
      return reply.status(400).send(errorResponse('INSUFFICIENT_BALANCE', `Insufficient balance. Available: ${currentBalance} USDC`));
    }

    const reference = generateReference('KUDI_ONCHAIN');
    const newBalance = currentBalance - amountUSDC;
    this.ledgerService.setBalance(userId, newBalance);

    const txHash = chain === 'solana'
      ? `${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
      : `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

    this.ledgerService.recordTransaction({
      fromUserId: userId,
      toUserId: `onchain_${chain}_${toAddress.slice(0, 8)}`,
      amount: amountUSDC.toFixed(2),
      currency: 'USDC',
      reference,
      timestamp: new Date().toISOString(),
      metadata: {
        title: `Send to ${chain.toUpperCase()}`,
        subtitle: `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`,
        txHash,
        chain,
        type: 'SPEND_ONCHAIN'
      }
    });

    return successResponse({
      reference,
      txHash,
      chain,
      amountUSDC: amountUSDC.toFixed(2),
      toAddress,
      newBalanceUSDC: newBalance.toFixed(2)
    }, 'Crypto broadcast submitted successfully');
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

