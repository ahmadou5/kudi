import { FastifyInstance } from 'fastify';
import { HealthController } from './health.controller';

export async function healthRoutes(server: FastifyInstance, controller: HealthController) {
  server.get('/api/v1/health', controller.getHealth);
  server.get('/health', controller.getHealth);
}
