import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { BillsController } from './bills.controller';

export async function billsRoutes(server: FastifyInstance, controller: BillsController) {
  server.post(apiRoutes.bills.pay, controller.payBill);
  server.post('/api/bills/pay', controller.payBill);
}
