import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { apiConfig } from '@kudi/config';
import { prisma } from '../../lib/prisma';
import { MaintenanceService } from '../../services/maintenanceService';

export class HealthController {
  constructor(
    private custodyManager: CustodyManager,
    private paymentRegistry: PaymentProviderRegistry,
    private maintenanceService?: MaintenanceService
  ) {}

  public getHealth = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      service: 'kudi-api',
      custodyTrack: this.custodyManager.getActiveTrack(),
      activePaymentProvider: this.paymentRegistry.getActiveProviderId(),
      sentryEnabled: Boolean(apiConfig.SENTRY_DSN),
      timestamp: new Date().toISOString(),
    });
  };

  public getHealthConfig = async (_request: FastifyRequest, reply: FastifyReply) => {
    let maintenance = {
      enabled: false,
      message: '',
      estimatedMinutes: null as number | null,
      updatedAt: null as string | null
    };

    if (this.maintenanceService) {
      maintenance = await this.maintenanceService.getMaintenanceConfig();
    } else {
      try {
        const config = await prisma.appConfig.findUnique({
          where: { key: 'maintenance' }
        });
        if (config?.value) {
          try {
            const parsed = JSON.parse(config.value);
            maintenance = {
              enabled: Boolean(parsed.enabled),
              message: parsed.message || '',
              estimatedMinutes: parsed.estimatedMinutes ?? null,
              updatedAt: parsed.updatedAt || config.updatedAt?.toISOString?.() || null
            };
          } catch {
            // ignore parse error
          }
        }
      } catch (err: any) {
        // Safe fallback if database is not reachable
      }
    }

    return reply.send({
      success: true,
      message: 'App config fetched',
      data: { maintenance }
    });
  };
}

