import { FastifyInstance } from 'fastify';
import { WebhooksController } from './webhooks.controller';

export async function webhooksRoutes(server: FastifyInstance, controller: WebhooksController) {
  server.post('/api/v1/webhooks/squad', controller.handleSquadWebhook);
  server.post('/api/v1/webhooks/monnify', controller.handleMonnifyWebhook);
  server.post('/api/v1/webhooks/paystack', controller.handlePaystackWebhook);
  server.post('/api/v1/webhooks/korapay', controller.handleKorapayWebhook);
  server.post('/api/v1/webhooks/privy', controller.handlePrivyWebhook);
}
