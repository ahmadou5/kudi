import Fastify from 'fastify';
import dotenv from 'dotenv';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import corsPlugin from './plugins/cors';
import helmetPlugin from './plugins/helmet';
import compressPlugin from './plugins/compress';
import jwtPlugin from './plugins/jwt';
import rateLimitPlugin from './plugins/rateLimit';
import redisPlugin from './plugins/redis';
import swaggerPlugin from './plugins/swagger';
import prismaPlugin from './plugins/prisma';
import { initSentry } from './lib/sentry';
import { RateService } from './services/rateService';
import { LedgerService } from './services/ledgerService';

import { HealthController } from './modules/health/health.controller';
import { healthRoutes } from './modules/health/health.routes';

import { AuthController } from './modules/auth/auth.controller';
import { authRoutes } from './modules/auth/auth.routes';

import { BalanceController } from './modules/balance/balance.controller';
import { balanceRoutes } from './modules/balance/balance.routes';

import { KYCController } from './modules/kyc/kyc.controller';
import { kycRoutes } from './modules/kyc/kyc.routes';

import { PayoutController } from './modules/payout/payout.controller';
import { payoutRoutes } from './modules/payout/payout.routes';

import { AdminController } from './modules/admin/admin.controller';
import { adminRoutes } from './modules/admin/admin.routes';

import { BillsController } from './modules/bills/bills.controller';
import { billsRoutes } from './modules/bills/bills.routes';

import { WebhooksController } from './modules/webhooks/webhooks.controller';
import { webhooksRoutes } from './modules/webhooks/webhooks.routes';

dotenv.config();

// Initialize Sentry error monitoring & performance profiling
initSentry();

const server = Fastify({ logger: true });

// Core shared infrastructure services
const custodyManager = new CustodyManager();
const paymentRegistry = new PaymentProviderRegistry();
const rateService = new RateService();
const ledgerService = new LedgerService();

// Domain Controllers
const healthController = new HealthController(custodyManager, paymentRegistry);
const authController = new AuthController(custodyManager, ledgerService);
const balanceController = new BalanceController(ledgerService, rateService);
const kycController = new KYCController(ledgerService);
const payoutController = new PayoutController(paymentRegistry, ledgerService, rateService);
const adminController = new AdminController(custodyManager, paymentRegistry, rateService);
const billsController = new BillsController(ledgerService, rateService);
const webhooksController = new WebhooksController(ledgerService);

async function main() {
  // Register Infrastructure Plugins
  await server.register(corsPlugin);
  await server.register(helmetPlugin);
  await server.register(compressPlugin);



  await server.register(jwtPlugin);
  await server.register(rateLimitPlugin);
  try {
    await server.register(redisPlugin);
  } catch (err) {
    server.log.warn('Redis plugin registration skipped');
  }
  await server.register(swaggerPlugin);

  await server.register(prismaPlugin);

  // Register Domain Modules (Percel Standard Architecture)
  await healthRoutes(server, healthController);
  await authRoutes(server, authController);
  await balanceRoutes(server, balanceController);
  await kycRoutes(server, kycController);
  await payoutRoutes(server, payoutController);
  await adminRoutes(server, adminController);
  await billsRoutes(server, billsController);
  await webhooksRoutes(server, webhooksController);

  const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;
  await server.listen({ port, host: '0.0.0.0' });
  rateService.startPolling(30_000);
  console.log(`🚀 Kudi API server running on http://localhost:${port}`);
}


main().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
