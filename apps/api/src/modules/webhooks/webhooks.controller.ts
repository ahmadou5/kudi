import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@kudi/database';
import { LedgerService } from '../../services/ledgerService';
import { RateService } from '../../services/rateService';
import { successResponse, errorResponse } from '../../utils/response';

export class WebhooksController {
  constructor(
    private ledgerService: LedgerService,
    private rateService?: RateService
  ) {}

  private timingSafeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  private verifyHmacSignature(
    payload: string,
    signatureHeader: string | undefined,
    secretKey: string,
    algorithm: 'sha512' | 'sha256' = 'sha512'
  ): boolean {
    if (!secretKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('Webhook secret not configured - rejecting webhook in production');
        return false;
      }
      console.warn('⚠️ Webhook Secret Key not configured in env - operating in Development Verification Mode');
      return true;
    }
    if (!signatureHeader) {
      return false;
    }
    const computedSignature = crypto
      .createHmac(algorithm, secretKey)
      .update(payload)
      .digest('hex');

    return this.timingSafeEquals(computedSignature, signatureHeader);
  }

  /**
   * Bachs webhook verification (docs.bachs.io/guides/webhooks):
   * HMAC-SHA256 of "{timestamp}.{raw_body}".
   * Prefer X-Bachs-Signature-V2 (`t={ts},v1={sig}[,v1={sig}...]` — accepts any
   * valid v1 so secret rotation stays safe); fall back to X-Bachs-Signature +
   * X-Bachs-Timestamp. 300s replay tolerance.
   */
  private verifyBachsSignature(request: FastifyRequest, rawBody: string, secret: string): boolean {
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('BACHS_WEBHOOK_SIGNING_SECRET not configured - rejecting Bachs webhook in production');
        return false;
      }
      console.warn('⚠️ BACHS_WEBHOOK_SIGNING_SECRET not configured - operating in Development Verification Mode');
      return true;
    }
    if (!rawBody) {
      return false;
    }

    const v2 = request.headers['x-bachs-signature-v2'] as string | undefined;
    const legacySignature = request.headers['x-bachs-signature'] as string | undefined;
    const timestampHeader = request.headers['x-bachs-timestamp'] as string | undefined;

    let timestamp: number;
    let candidates: string[];

    if (v2) {
      const parts = v2.split(',').map((p) => p.trim()).filter(Boolean);
      const tPart = parts.find((p) => p.startsWith('t='));
      if (!tPart) return false;
      timestamp = parseInt(tPart.slice(2), 10);
      candidates = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
    } else if (legacySignature && timestampHeader) {
      timestamp = parseInt(timestampHeader, 10);
      candidates = [legacySignature];
    } else {
      return false;
    }

    if (!Number.isFinite(timestamp) || candidates.length === 0) return false;
    if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`, 'utf-8')
      .digest('hex');

    return candidates.some((c) => this.timingSafeEquals(expected, c));
  }

  private getRawBody(request: FastifyRequest): string {
    return request.rawBody ?? JSON.stringify(request.body);
  }

  private async reserveWebhookEvent(
    provider: string,
    eventId: string | undefined,
    eventType: string | undefined,
    payload: unknown
  ): Promise<boolean> {
    if (!eventId) {
      return true;
    }

    const idempotencyKey = `${provider}:${eventId}`;

    try {
      await prisma.processedWebhook.create({
        data: {
          provider,
          eventId,
          idempotencyKey,
          eventType,
          payload: JSON.stringify(payload)
        }
      });
      return true;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        console.log(`ℹ️ Duplicate webhook skipped: ${idempotencyKey}`);
        return false;
      }
      throw err;
    }
  }

  public handleSquadWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = this.getRawBody(request);
    const signature = (request.headers['x-squad-signature'] || request.headers['x-squad-encrypted-body']) as string | undefined;
    const secretKey = process.env.SQUAD_SECRET_KEY || '';

    const body = request.body as any;
    const event = body.event || body.event_type || body.Event || (body.channel === 'virtual-account' ? 'virtual-account.credit' : undefined);
    const data = body.data || body.Body || body;

    // Verify signature: supports raw body HMAC-SHA512 and pipe-delimited Squad format
    if (secretKey && signature) {
      const rawMatch = this.verifyHmacSignature(rawBody, signature, secretKey);
      let pipeMatch = false;
      if (!rawMatch && data.virtual_account_number) {
        const pipeString = `${data.transaction_reference || ''}|${data.virtual_account_number || ''}|${data.currency || 'NGN'}|${data.principal_amount || ''}|${data.settled_amount || ''}|${data.customer_identifier || ''}`;
        pipeMatch = this.verifyHmacSignature(pipeString, signature, secretKey);
      }
      if (!rawMatch && !pipeMatch) {
        return reply.status(401).send(errorResponse('UNAUTHORIZED_WEBHOOK', 'Invalid Squad HMAC Signature'));
      }
    }

    console.log(`📥 Received Squad Webhook Event: ${event}`, data);

    const reference = data.transaction_reference || data.transaction_ref || data.reference || body.TransactionRef;
    const accepted = await this.reserveWebhookEvent('squad', reference, event, body);
    if (!accepted) {
      return successResponse({ received: true, duplicate: true }, 'Duplicate Squad webhook skipped');
    }

    const isVirtualAccountDeposit =
      body.channel === 'virtual-account' ||
      data.channel === 'virtual-account' ||
      event === 'virtual_account.deposit' ||
      event === 'virtual-account.credit' ||
      event === 'charge.success' ||
      body.Event === 'charge_successful' ||
      data.transaction_indicator === 'C';

    if (isVirtualAccountDeposit) {
      const accountNumber = data.virtual_account_number || data.account_number;
      let amountNGN = 0;

      if (data.principal_amount) {
        amountNGN = parseFloat(String(data.principal_amount));
      } else if (data.settled_amount) {
        amountNGN = parseFloat(String(data.settled_amount));
      } else if (data.amount) {
        amountNGN = Number(data.amount) / 100;
      }

      // Resolve user by customer_identifier (KUDI_VA_${userId}) or by virtual account number in DB
      let targetUserId: string | undefined;
      const custId = data.customer_identifier || body.customer_identifier;
      if (custId && typeof custId === 'string' && custId.startsWith('KUDI_VA_')) {
        targetUserId = custId.replace('KUDI_VA_', '');
      }

      if (!targetUserId && accountNumber) {
        const va = await prisma.virtualAccount.findFirst({
          where: { accountNumber }
        });
        if (va) {
          targetUserId = va.userId;
        }
      }

      if (targetUserId && amountNGN > 0) {
        const rate = this.rateService?.getCurrentRate() || 1500;
        const amountUSDC = amountNGN / rate;

        this.ledgerService.creditUserBalance(
          targetUserId,
          amountUSDC,
          `SQUAD_WH_${reference}`,
          {
            type: 'NGN_VIRTUAL_ACCOUNT_DEPOSIT',
            provider: 'SQUAD',
            accountNumber,
            amountNGN,
            rateNGN: rate,
            senderRemarks: data.remarks || data.sender_name
          }
        );
        console.log(`✅ [Squad Webhook] Credited user ${targetUserId} with ${amountUSDC.toFixed(2)} USDC (₦${amountNGN}) via Squad VA ${accountNumber}`);
      } else if (accountNumber && reference) {
        // Fallback transaction recording into double-entry ledger
        this.ledgerService.recordTransaction({
          fromUserId: 'squad_gateway',
          toUserId: targetUserId || `user_acc_${accountNumber}`,
          amount: amountNGN || 0,
          currency: 'NGN',
          reference: `SQUAD_WH_${reference}`
        });
      }
    } else if (event === 'transfer_successful' || event === 'payout.success') {
      console.log(`✅ [Squad Webhook] Outbound transfer confirmed: ${reference}`);
      await this.ledgerService.confirmSpendTransaction(reference);
    } else if (event === 'transfer_failed' || event === 'payout.failed') {
      const reason = data.message || data.remark || 'Squad transfer rejected by banking network';
      console.warn(`⚠️ [Squad Webhook] Outbound transfer failed for ${reference}: ${reason}. Triggering balance reversal.`);
      await this.ledgerService.reverseSpendTransaction(reference, reason);
    }

    return successResponse({ received: true }, 'Squad webhook processed successfully');
  };

  public handleMonnifyWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = this.getRawBody(request);
    const signature = request.headers['monnify-signature'] as string | undefined;
    const secretKey = process.env.MONNIFY_SECRET_KEY || '';

    if (!this.verifyHmacSignature(rawBody, signature, secretKey)) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED_WEBHOOK', 'Invalid Monnify Signature'));
    }

    const body = request.body as any;
    const eventType = body.eventType;
    const eventData = body.eventData || {};

    console.log(`📥 Received Monnify Webhook Event: ${eventType}`, eventData);

    const reference = eventData.transactionReference;
    const accepted = await this.reserveWebhookEvent('monnify', reference, eventType, body);
    if (!accepted) {
      return successResponse({ received: true, duplicate: true }, 'Duplicate Monnify webhook skipped');
    }

    if (eventType === 'SUCCESSFUL_TRANSACTION') {
      const destinationAccount = eventData.destinationAccountInformation?.accountNumber;
      const amountNGN = parseFloat(String(eventData.amountPaid || '0'));

      let targetUserId: string | undefined;
      const accRef = eventData.accountReference || eventData.product?.reference;
      if (accRef && typeof accRef === 'string' && accRef.startsWith('KUDI_VA_')) {
        targetUserId = accRef.replace('KUDI_VA_', '');
      }

      if (!targetUserId && destinationAccount) {
        const va = await prisma.virtualAccount.findFirst({
          where: { accountNumber: destinationAccount }
        });
        if (va) targetUserId = va.userId;
      }

      if (targetUserId && amountNGN > 0) {
        const rate = this.rateService?.getCurrentRate() || 1500;
        const amountUSDC = amountNGN / rate;

        this.ledgerService.creditUserBalance(
          targetUserId,
          amountUSDC,
          `MNF_WH_${reference}`,
          {
            type: 'NGN_VIRTUAL_ACCOUNT_DEPOSIT',
            provider: 'MONNIFY',
            accountNumber: destinationAccount,
            amountNGN,
            rateNGN: rate,
            payerName: eventData.paymentDescription || eventData.customer?.name
          }
        );
        console.log(`✅ [Monnify Webhook] Credited user ${targetUserId} with ${amountUSDC.toFixed(2)} USDC (₦${amountNGN}) via Monnify VA ${destinationAccount}`);
      } else if (destinationAccount && reference) {
        this.ledgerService.recordTransaction({
          fromUserId: 'monnify_gateway',
          toUserId: targetUserId || `user_acc_${destinationAccount}`,
          amount: amountNGN || 0,
          currency: 'NGN',
          reference: `MNF_WH_${reference}`
        });
      }
    } else if (eventType === 'DISBURSEMENT_SUCCESSFUL') {
      console.log(`✅ [Monnify Webhook] Outbound transfer confirmed: ${reference}`);
      await this.ledgerService.confirmSpendTransaction(reference);
    } else if (eventType === 'DISBURSEMENT_FAILED') {
      const reason = eventData.responseMessage || eventData.comment || 'Monnify disbursement rejected by banking network';
      console.warn(`⚠️ [Monnify Webhook] Outbound transfer failed for ${reference}: ${reason}. Triggering balance reversal.`);
      await this.ledgerService.reverseSpendTransaction(reference, reason);
    }

    return successResponse({ received: true }, 'Monnify webhook processed successfully');
  };

  public handleKorapayWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = this.getRawBody(request);
    const signature = request.headers['x-korapay-signature'] as string | undefined;
    const secretKey = process.env.KORAPAY_SECRET_KEY || '';

    if (!this.verifyHmacSignature(rawBody, signature, secretKey)) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED_WEBHOOK', 'Invalid Korapay Signature'));
    }

    const body = request.body as any;
    const event = body.event;
    const data = body.data || {};

    console.log(`📥 Received Korapay Webhook Event: ${event}`, data);

    const reference = data.reference;
    const accepted = await this.reserveWebhookEvent('korapay', reference, event, body);
    if (!accepted) {
      return successResponse({ received: true, duplicate: true }, 'Duplicate Korapay webhook skipped');
    }

    if (event === 'charge.success' || event === 'transfer.success') {
      const amount = data.amount ? String(data.amount) : '0.00';

      if (reference) {
        this.ledgerService.recordTransaction({
          fromUserId: 'korapay_gateway',
          toUserId: `user_ref_${reference}`,
          amount,
          currency: 'NGN',
          reference: `KRA_WH_${reference}`
        });
      }
    }

    return successResponse({ received: true }, 'Korapay webhook processed successfully');
  };

  public handleBachsWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = this.getRawBody(request);
    const signingSecret = process.env.BACHS_WEBHOOK_SIGNING_SECRET || '';

    if (!this.verifyBachsSignature(request, rawBody, signingSecret)) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED_WEBHOOK', 'Invalid Bachs Signature'));
    }

    const body = request.body as any;
    const event = body.type;
    const data = body.data || {};

    console.log(`📥 Received Bachs Webhook Event: ${event}`, data);

    const accepted = await this.reserveWebhookEvent('bachs', body.id, event, body);
    if (!accepted) {
      return successResponse({ received: true, duplicate: true }, 'Duplicate Bachs webhook skipped');
    }

    if (event === 'collection.succeeded') {
      const reference = data.id;
      const amountNGN = data.amount ? String(data.amount) : '0.00';
      const currency = data.currency || 'NGN';
      const settlementAmount = data.settlement_amount || '0.00';
      const settlementCurrency = data.settlement_currency || 'NGN';
      const processingFee = data.processing_fee || '0.00';
      const feeBearer = data.fee_bearer || 'merchant';

      const senderName = data.payment_method_details?.bank_transfer?.sender_name;
      const senderBank = data.payment_method_details?.bank_transfer?.sender_bank;
      const senderAccountNumber = data.payment_method_details?.bank_transfer?.sender_account_number;
      const virtualAccount = data.payment_method_details?.bank_transfer?.virtual_account;
      const vaAccountNumber = virtualAccount?.account_number;
      const vaBankName = virtualAccount?.bank_name;
      const vaId = virtualAccount?.id;

      let targetUserId: string | undefined;

      // Resolve user by the virtual account number (VA belongs to a Kudi user)
      if (vaAccountNumber) {
        const va = await prisma.virtualAccount.findFirst({
          where: { accountNumber: vaAccountNumber }
        });
        if (va) {
          targetUserId = va.userId;
        }
      }

      if (!targetUserId && senderName) {
        const user = this.ledgerService.findUserByPrivyOrEmail(undefined, senderName);
        if (user) targetUserId = user.id;
      }

      let amountToCredit = parseFloat(amountNGN);
      if (processingFee && feeBearer === 'merchant') {
        // Apply Bachs fee (1.5% capped at 300) - fee already deducted in settlement amount
        amountToCredit = parseFloat(settlementAmount);
      }

      if (targetUserId && amountToCredit > 0) {
        const rate = this.rateService?.getCurrentRate() || 1500;
        const amountUSDC = amountToCredit / rate;

        this.ledgerService.creditUserBalance(
          targetUserId,
          amountUSDC,
          `BACHS_WH_${reference}`,
          {
            type: 'NGN_VIRTUAL_ACCOUNT_DEPOSIT',
            provider: 'BACHS',
            accountNumber: vaAccountNumber || senderAccountNumber,
            amountNGN: parseFloat(amountNGN),
            rateNGN: rate,
            senderRemarks: senderName ? `${senderName} from ${senderBank}` : undefined,
            metadata: {
              settlementAmount: settlementAmount,
              settlementCurrency: settlementCurrency,
              processingFee: processingFee,
              feeBearer: feeBearer,
              vaId: vaId
            }
          }
        );
        console.log(`✅ [Bachs Webhook] Credited user ${targetUserId} with ${amountUSDC.toFixed(2)} USDC (₦${amountNGN}) via Bachs VA ${vaAccountNumber || senderAccountNumber}`);
      } else if (vaAccountNumber && reference) {
        this.ledgerService.recordTransaction({
          fromUserId: 'bachs_gateway',
          toUserId: targetUserId || `user_acc_${vaAccountNumber}`,
          amount: parseFloat(amountNGN) || 0,
          currency: 'NGN',
          reference: `BACHS_WH_${reference}`
        });
      }
    } else if (event === 'payout.created') {
      console.log(`📥 [Bachs Webhook] Payout created: ${data.reference || data.id} (status: ${data.status})`);
    } else if (event === 'payout.paid') {
      const payoutRef = data.reference || data.id;
      console.log(`✅ [Bachs Webhook] Payout paid: ${payoutRef}`);
      await this.ledgerService.confirmSpendTransaction(payoutRef);
    } else if (event === 'payout.failed') {
      const payoutRef = data.reference || data.id;
      const reason = data.failure_reason || 'Bachs payout could not be delivered';
      console.warn(`⚠️ [Bachs Webhook] Payout failed for ${payoutRef}: ${reason}. Triggering balance reversal.`);
      await this.ledgerService.reverseSpendTransaction(payoutRef, reason);
    } else if (event === 'capability.updated') {
      console.log(`📥 [Bachs Webhook] Capability updated: ${data.status}`);
    }

    return successResponse({ received: true }, 'Bachs webhook processed successfully');
  };

  public handlePrivyWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const eventType = body.type;
    const user = body.user || {};

    console.log(`📥 Received Privy Webhook Event: ${eventType}`, user);

    const accepted = await this.reserveWebhookEvent('privy', body.id || user.id, eventType, body);
    if (!accepted) {
      return successResponse({ received: true, duplicate: true }, 'Duplicate Privy webhook skipped');
    }

    if (eventType === 'user.created' && user.id) {
      this.ledgerService.registerUser(user.id, user.phone?.number || '', user.email?.address || '');
    }

    return successResponse({ received: true }, 'Privy webhook processed successfully');
  };
}
