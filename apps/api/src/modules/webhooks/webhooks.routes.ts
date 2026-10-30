import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebhooksController } from './webhooks.controller';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export async function webhooksRoutes(server: FastifyInstance, controller: WebhooksController) {
  await server.register(async (instance) => {
    // Encapsulated to webhook routes only: keep the exact raw bytes for HMAC
    // signature verification (providers sign the raw body, not re-serialized JSON).
    instance.addContentTypeParser('application/json', { parseAs: 'string' }, (req: FastifyRequest, body, done) => {
      req.rawBody = typeof body === 'string' ? body : body.toString('utf8');
      try {
        done(null, JSON.parse(req.rawBody));
      } catch (err) {
        done(err as Error, undefined);
      }
    });

    instance.post('/api/v1/webhooks/squad', controller.handleSquadWebhook);
    instance.post('/api/v1/webhooks/monnify', controller.handleMonnifyWebhook);
    instance.post('/api/v1/webhooks/korapay', controller.handleKorapayWebhook);
    instance.post('/api/v1/webhooks/bachs', controller.handleBachsWebhook);
    instance.post('/api/v1/webhooks/privy', controller.handlePrivyWebhook);
  });
}
