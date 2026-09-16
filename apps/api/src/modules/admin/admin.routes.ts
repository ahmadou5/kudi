import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { AdminController } from './admin.controller';
import { requireAdmin } from '../../utils/authGuards';

export async function adminRoutes(server: FastifyInstance, controller: AdminController) {
  server.get(apiRoutes.rates.current, controller.getCurrentRates);
  server.get('/api/rates/current', controller.getCurrentRates);
  server.post(apiRoutes.admin.rateOverride, { preHandler: requireAdmin }, controller.overrideRate);
  server.post('/api/admin/rate-override', { preHandler: requireAdmin }, controller.overrideRate);
  server.get(apiRoutes.admin.config, { preHandler: requireAdmin }, controller.getConfig);
  server.get('/api/admin/config', { preHandler: requireAdmin }, controller.getConfig);
  server.get('/api/v1/admin/deposits', { preHandler: requireAdmin }, controller.getDeposits);
  server.get('/api/admin/deposits', { preHandler: requireAdmin }, controller.getDeposits);
  server.get('/api/v1/admin/sweeps/health', { preHandler: requireAdmin }, controller.getSweepHealth);
  server.get('/api/admin/sweeps/health', { preHandler: requireAdmin }, controller.getSweepHealth);
  server.get('/api/v1/admin/operator-alerts', { preHandler: requireAdmin }, controller.getOperatorAlerts);
  server.get('/api/admin/operator-alerts', { preHandler: requireAdmin }, controller.getOperatorAlerts);
  server.post('/api/v1/admin/sweeps/:signature/requeue', { preHandler: requireAdmin }, controller.requeueSweep);
  server.post('/api/admin/sweeps/:signature/requeue', { preHandler: requireAdmin }, controller.requeueSweep);
  server.post(apiRoutes.admin.setActiveProvider, { preHandler: requireAdmin }, controller.setActiveProvider);
  server.post('/api/admin/set-active-provider', { preHandler: requireAdmin }, controller.setActiveProvider);
  server.get(apiRoutes.admin.exportReconciliationCsv, { preHandler: requireAdmin }, controller.exportReconciliationCSV);
  server.get('/api/admin/reconciliation/export-csv', { preHandler: requireAdmin }, controller.exportReconciliationCSV);
}
