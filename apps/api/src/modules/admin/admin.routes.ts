import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { AdminController } from './admin.controller';

export async function adminRoutes(server: FastifyInstance, controller: AdminController) {
  server.get(apiRoutes.rates.current, controller.getCurrentRates);
  server.get('/api/rates/current', controller.getCurrentRates);
  server.post(apiRoutes.admin.rateOverride, controller.overrideRate);
  server.post('/api/admin/rate-override', controller.overrideRate);
  server.get(apiRoutes.admin.config, controller.getConfig);
  server.get('/api/admin/config', controller.getConfig);
  server.post(apiRoutes.admin.setActiveProvider, controller.setActiveProvider);
  server.post('/api/admin/set-active-provider', controller.setActiveProvider);
  server.get(apiRoutes.admin.exportReconciliationCsv, controller.exportReconciliationCSV);
  server.get('/api/admin/reconciliation/export-csv', controller.exportReconciliationCSV);
}
