import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller';

export async function adminRoutes(server: FastifyInstance, controller: AdminController) {
  server.get('/api/v1/rates/current', controller.getCurrentRates);
  server.get('/api/rates/current', controller.getCurrentRates);
  server.post('/api/v1/admin/rate-override', controller.overrideRate);
  server.post('/api/admin/rate-override', controller.overrideRate);
  server.get('/api/v1/admin/config', controller.getConfig);
  server.get('/api/admin/config', controller.getConfig);
  server.post('/api/v1/admin/set-active-provider', controller.setActiveProvider);
  server.post('/api/admin/set-active-provider', controller.setActiveProvider);
  server.get('/api/v1/admin/reconciliation/export-csv', controller.exportReconciliationCSV);
  server.get('/api/admin/reconciliation/export-csv', controller.exportReconciliationCSV);
}
