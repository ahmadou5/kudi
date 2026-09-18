import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { HealthController } from './health.controller';

export async function healthRoutes(server: FastifyInstance, controller: HealthController) {
  server.get(apiRoutes.health, controller.getHealth);
  server.get('/health', controller.getHealth);
  server.get(apiRoutes.healthConfig, controller.getHealthConfig);
  server.get('/health/config', controller.getHealthConfig);
  server.get('/api/health/config', controller.getHealthConfig);
}
