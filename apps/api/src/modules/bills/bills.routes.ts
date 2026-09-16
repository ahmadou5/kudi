import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { BillsController } from './bills.controller';
import { requireAuth } from '../../utils/authGuards';

export async function billsRoutes(server: FastifyInstance, controller: BillsController) {
  server.post(apiRoutes.bills.pay, { preHandler: requireAuth }, controller.payBill);
  server.post('/api/bills/pay', { preHandler: requireAuth }, controller.payBill);
}
