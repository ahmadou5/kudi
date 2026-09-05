import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller';

export async function adminRoutes(server: FastifyInstance, controller: AdminController) {
  server.get('/api/rates/current', controller.getCurrentRates);
  server.post('/api/admin/rate-override', controller.overrideRate);
  server.get('/api/admin/config', controller.getConfig);
  server.post('/api/admin/set-active-provider', controller.setActiveProvider);
  server.get('/api/admin/reconciliation/export-csv', controller.exportReconciliationCSV);
}
