import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@kudi/database';
import { LedgerService } from '../../services/ledgerService';
import { successResponse, errorResponse } from '../../utils/response';

export class WebhooksController {
  constructor(private ledgerService: LedgerService) {}

  private verifyHmacSignature(
    payload: string,
    signatureHeader: string | undefined,
    secretKey: string
  ): boolean {
    if (!secretKey) {
      // In dev mode without secret key, log warning and allow request
      console.warn('⚠️ Webhook Secret Key not configured in env - operating in Development Verification Mode');
      return true;
    }
    if (!signatureHeader) {
      return false;
    }
    const computedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'utf-8'),
      Buffer.from(signatureHeader, 'utf-8')
    );
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
    const rawBody = JSON.stringify(request.body);
    const signature = request.headers['x-squad-signature'] as string | undefined;
    const secretKey = process.env.SQUAD_SECRET_KEY || '';

    if (!this.verifyHmacSignature(rawBody, signature, secretKey)) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED_WEBHOOK', 'Invalid Squad HMAC Signature'));
    }

    const body = request.body as any;
    const event = body.event || body.event_type;
    const data = body.data || body;

    console.log(`📥 Received Squad Webhook Event: ${event}`, data);

    const reference = data.transaction_ref || data.reference;
    const accepted = await this.reserveWebhookEvent('squad', reference, event, body);
    if (!accepted) {
      return successResponse({ received: true, duplicate: true }, 'Duplicate Squad webhook skipped');
    }

    if (event === 'charge.success' || event === 'virtual_account.deposit') {
      const amount = data.amount ? String(data.amount / 100) : '0.00';
      const accountNumber = data.virtual_account_number || data.account_number;

      if (accountNumber && reference) {
        // Record deposit into double-entry ledger
        this.ledgerService.recordTransaction({
          fromUserId: 'squad_gateway',
          toUserId: `user_acc_${accountNumber}`,
          amount,
          currency: 'NGN',
          reference: `SQUAD_WH_${reference}`
        });
      }
    }

    return successResponse({ received: true }, 'Squad webhook processed successfully');
  };

  public handleMonnifyWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = JSON.stringify(request.body);
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
      const amount = eventData.amountPaid ? String(eventData.amountPaid) : '0.00';
      const destinationAccount = eventData.destinationAccountInformation?.accountNumber;

      if (destinationAccount && reference) {
        this.ledgerService.recordTransaction({
          fromUserId: 'monnify_gateway',
          toUserId: `user_acc_${destinationAccount}`,
          amount,
          currency: 'NGN',
          reference: `MNF_WH_${reference}`
        });
      }
    }

    return successResponse({ received: true }, 'Monnify webhook processed successfully');
  };

  public handlePaystackWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = JSON.stringify(request.body);
    const signature = request.headers['x-paystack-signature'] as string | undefined;
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';

    if (!this.verifyHmacSignature(rawBody, signature, secretKey)) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED_WEBHOOK', 'Invalid Paystack Signature'));
    }

    const body = request.body as any;
    const event = body.event;
    const data = body.data || {};

    console.log(`📥 Received Paystack Webhook Event: ${event}`, data);

    const reference = data.reference;
    const accepted = await this.reserveWebhookEvent('paystack', reference, event, body);
    if (!accepted) {
      return successResponse({ received: true, duplicate: true }, 'Duplicate Paystack webhook skipped');
    }

    if (event === 'charge.success') {
      const amount = data.amount ? String(data.amount / 100) : '0.00';
      const customerEmail = data.customer?.email;

      if (customerEmail && reference) {
        this.ledgerService.recordTransaction({
          fromUserId: 'paystack_gateway',
          toUserId: `user_email_${customerEmail}`,
          amount,
          currency: 'NGN',
          reference: `PST_WH_${reference}`
        });
      }
    }

    return successResponse({ received: true }, 'Paystack webhook processed successfully');
  };

  public handleKorapayWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = JSON.stringify(request.body);
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
