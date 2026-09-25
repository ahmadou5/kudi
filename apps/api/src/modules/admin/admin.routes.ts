import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { AdminController } from './admin.controller';
import { requireAdmin } from '../../utils/authGuards';

/**
 * Stricter per-route rate limit for admin fund-operation endpoints
 * (sweep config, requeue/recheck). The global rate-limit plugin still applies
 * everywhere; this overrides it to a tighter budget on fund mutations.
 * Audit logging for these endpoints lives in AdminController
 * (SWEEP_CONFIG_UPDATE / SWEEP_REQUEUE / SWEEP_RECHECK via recordAdminAudit).
 */
const fundMutationRateLimit = {
  rateLimit: { max: 20, timeWindow: '1 minute' }
};

export async function adminRoutes(server: FastifyInstance, controller: AdminController) {
  server.get(apiRoutes.rates.current, controller.getCurrentRates);
  server.get('/api/rates/current', controller.getCurrentRates);
  server.get('/api/v1/admin/dashboard', { preHandler: requireAdmin }, controller.getDashboard);
  server.get('/api/admin/dashboard', { preHandler: requireAdmin }, controller.getDashboard);
  server.get('/api/v1/admin/users', { preHandler: requireAdmin }, controller.getUsers);
  server.get('/api/admin/users', { preHandler: requireAdmin }, controller.getUsers);
  server.post(apiRoutes.admin.userRole(), { preHandler: requireAdmin }, controller.updateUserRole);
  server.post('/api/admin/users/:userId/role', { preHandler: requireAdmin }, controller.updateUserRole);
  server.get('/api/v1/admin/transactions', { preHandler: requireAdmin }, controller.getTransactions);
  server.get('/api/admin/transactions', { preHandler: requireAdmin }, controller.getTransactions);
  server.post(apiRoutes.admin.rateOverride, { preHandler: requireAdmin }, controller.overrideRate);
  server.post('/api/admin/rate-override', { preHandler: requireAdmin }, controller.overrideRate);
  server.get(apiRoutes.admin.config, { preHandler: requireAdmin }, controller.getConfig);
  server.get('/api/admin/config', { preHandler: requireAdmin }, controller.getConfig);
  server.get(apiRoutes.admin.maintenance, { preHandler: requireAdmin }, controller.getMaintenanceConfig);
  server.get('/api/admin/config/maintenance', { preHandler: requireAdmin }, controller.getMaintenanceConfig);
  server.post(apiRoutes.admin.maintenance, { preHandler: requireAdmin }, controller.setMaintenanceConfig);
  server.post('/api/admin/config/maintenance', { preHandler: requireAdmin }, controller.setMaintenanceConfig);
  server.get('/api/admin/config/sweep', { preHandler: requireAdmin }, controller.getSweepConfig);
  server.get('/api/v1/admin/config/sweep', { preHandler: requireAdmin }, controller.getSweepConfig);
  server.post('/api/admin/config/sweep', { preHandler: requireAdmin, config: fundMutationRateLimit }, controller.setSweepConfig);
  server.post('/api/v1/admin/config/sweep', { preHandler: requireAdmin, config: fundMutationRateLimit }, controller.setSweepConfig);
  server.get('/api/admin/settings', { preHandler: requireAdmin }, controller.getSystemSettings);
  server.get('/api/v1/admin/settings', { preHandler: requireAdmin }, controller.getSystemSettings);
  server.get('/api/v1/admin/deposits', { preHandler: requireAdmin }, controller.getDeposits);
  server.get('/api/admin/deposits', { preHandler: requireAdmin }, controller.getDeposits);
  server.get('/api/v1/admin/drips', { preHandler: requireAdmin }, controller.getDrips);
  server.get('/api/admin/drips', { preHandler: requireAdmin }, controller.getDrips);
  server.get('/api/v1/admin/treasury', { preHandler: requireAdmin }, controller.getTreasury);
  server.get('/api/admin/treasury', { preHandler: requireAdmin }, controller.getTreasury);
  server.get('/api/v1/admin/sweeps/health', { preHandler: requireAdmin }, controller.getSweepHealth);
  server.get('/api/admin/sweeps/health', { preHandler: requireAdmin }, controller.getSweepHealth);
  server.get('/api/v1/admin/operator-alerts', { preHandler: requireAdmin }, controller.getOperatorAlerts);
  server.get('/api/admin/operator-alerts', { preHandler: requireAdmin }, controller.getOperatorAlerts);
  server.post('/api/v1/admin/sweeps/:signature/requeue', { preHandler: requireAdmin, config: fundMutationRateLimit }, controller.requeueSweep);
  server.post('/api/admin/sweeps/:signature/requeue', { preHandler: requireAdmin, config: fundMutationRateLimit }, controller.requeueSweep);
  server.post('/api/v1/admin/sweeps/:signature/recheck', { preHandler: requireAdmin, config: fundMutationRateLimit }, controller.recheckSweep);
  server.post('/api/admin/sweeps/:signature/recheck', { preHandler: requireAdmin, config: fundMutationRateLimit }, controller.recheckSweep);
  server.post(apiRoutes.admin.setActiveProvider, { preHandler: requireAdmin }, controller.setActiveProvider);
  server.post('/api/admin/set-active-provider', { preHandler: requireAdmin }, controller.setActiveProvider);
  server.get('/api/v1/admin/rails', { preHandler: requireAdmin }, controller.getPayoutRails);
  server.get('/api/admin/rails', { preHandler: requireAdmin }, controller.getPayoutRails);
  server.get(apiRoutes.admin.exportReconciliationCsv, { preHandler: requireAdmin }, controller.exportReconciliationCSV);
  server.get('/api/admin/reconciliation/export-csv', { preHandler: requireAdmin }, controller.exportReconciliationCSV);
}
