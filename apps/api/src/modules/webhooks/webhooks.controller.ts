import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
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

    if (event === 'charge.success' || event === 'virtual_account.deposit') {
      const reference = data.transaction_ref || data.reference;
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

    if (eventType === 'SUCCESSFUL_TRANSACTION') {
      const reference = eventData.transactionReference;
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

    if (event === 'charge.success') {
      const reference = data.reference;
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

    if (event === 'charge.success' || event === 'transfer.success') {
      const reference = data.reference;
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

    if (eventType === 'user.created' && user.id) {
      this.ledgerService.registerUser(user.id, user.phone?.number || '', user.email?.address || '');
    }

    return successResponse({ received: true }, 'Privy webhook processed successfully');
  };
}
