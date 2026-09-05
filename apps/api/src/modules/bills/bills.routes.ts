import { FastifyInstance } from 'fastify';
import { BillsController } from './bills.controller';

export async function billsRoutes(server: FastifyInstance, controller: BillsController) {
  server.post('/api/bills/pay', controller.payBill);
}
