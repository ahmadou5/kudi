import { prisma } from '../lib/prisma';
import type { Server as SocketIOServer } from 'socket.io';

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  estimatedMinutes: number | null;
  updatedAt: string | null;
}

export class MaintenanceService {
  private cache: MaintenanceState = {
    enabled: false,
    message: '',
    estimatedMinutes: null,
    updatedAt: null
  };
  private lastFetchedAt = 0;
  private cacheTtlMs = 5000;
  private io?: SocketIOServer;

  constructor(io?: SocketIOServer) {
    this.io = io;
  }

  public setSocketServer(io: SocketIOServer) {
    this.io = io;
  }

  public async getMaintenanceConfig(forceRefresh = false): Promise<MaintenanceState> {
    const now = Date.now();
    if (!forceRefresh && now - this.lastFetchedAt < this.cacheTtlMs) {
      return this.cache;
    }

    try {
      const row = await prisma.appConfig.findUnique({
        where: { key: 'maintenance' }
      });

      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value);
          this.cache = {
            enabled: Boolean(parsed.enabled),
            message: typeof parsed.message === 'string' ? parsed.message : '',
            estimatedMinutes: typeof parsed.estimatedMinutes === 'number' ? parsed.estimatedMinutes : null,
            updatedAt: parsed.updatedAt || row.updatedAt?.toISOString?.() || null
          };
        } catch {
          // Keep current cache if JSON parse fails
        }
      } else {
        this.cache = {
          enabled: false,
          message: '',
          estimatedMinutes: null,
          updatedAt: null
        };
      }
      this.lastFetchedAt = now;
    } catch (err: any) {
      // In case of DB disconnection, retain last known state
    }

    return this.cache;
  }

  public async setMaintenanceConfig(payload: {
    enabled: boolean;
    message?: string;
    estimatedMinutes?: number | null;
  }): Promise<MaintenanceState> {
    const nextState: MaintenanceState = {
      enabled: Boolean(payload.enabled),
      message: payload.message?.trim() || '',
      estimatedMinutes: typeof payload.estimatedMinutes === 'number' ? payload.estimatedMinutes : null,
      updatedAt: new Date().toISOString()
    };

    const configValue = JSON.stringify(nextState);

    await prisma.appConfig.upsert({
      where: { key: 'maintenance' },
      update: { value: configValue },
      create: { key: 'maintenance', value: configValue }
    });

    this.cache = nextState;
    this.lastFetchedAt = Date.now();

    // Broadcast in real time to all connected sockets
    if (this.io) {
      this.io.emit('system:maintenance', nextState);
    }

    return nextState;
  }

  public isBypassedUrl(url: string): boolean {
    const cleanUrl = url.split('?')[0];

    // Admin dashboard routes must never be blocked
    if (cleanUrl.startsWith('/api/v1/admin') || cleanUrl.startsWith('/api/admin')) {
      return true;
    }

    // Health and config checks must remain open for clients to poll status
    if (cleanUrl.startsWith('/api/v1/health') || cleanUrl.startsWith('/health') || cleanUrl.startsWith('/api/health')) {
      return true;
    }

    // Documentation & API root
    if (cleanUrl === '/' || cleanUrl.startsWith('/documentation')) {
      return true;
    }

    // Inbound webhooks from blockchain RPCs / payment providers
    if (cleanUrl.startsWith('/api/v1/webhooks') || cleanUrl.startsWith('/api/webhooks')) {
      return true;
    }

    return false;
  }
}
