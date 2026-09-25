import { FastifyReply, FastifyRequest } from 'fastify';
import { apiConfig } from '@kudi/config';
import { errorResponse } from './response';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
}

export function getAuthenticatedUser(request: FastifyRequest): AuthenticatedUser | undefined {
  const user = request.user as Partial<AuthenticatedUser> | undefined;
  if (!user?.userId) return undefined;
  return user as AuthenticatedUser;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    void reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication is required', 401));
  }
}

export function requireSelfParam(paramName = 'userId') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const authUser = getAuthenticatedUser(request);
    const params = (request.params || {}) as Record<string, string | undefined>;
    const requestedUserId = params[paramName];

    if (!authUser || !requestedUserId || authUser.userId !== requestedUserId) {
      void reply.status(403).send(errorResponse('FORBIDDEN', 'You can only access your own account', 403));
    }
  };
}

export function requireSelfBody(fieldName = 'userId') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(request, reply);
    if (reply.sent) return;

    const authUser = getAuthenticatedUser(request);
    const body = (request.body || {}) as Record<string, unknown>;
    const requestedUserId = body[fieldName];

    if (!authUser || typeof requestedUserId !== 'string' || authUser.userId !== requestedUserId) {
      void reply.status(403).send(errorResponse('FORBIDDEN', 'You can only move funds from your own account', 403));
    }
  };
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const adminKey = request.headers['x-admin-key'];
  const configuredKey = apiConfig.ADMIN_API_KEY;

  // Real admin auth is required in ALL environments. There is no dev-key
  // bypass: fund-operation endpoints (deposits rescan/balance/treasury, sweep
  // config, sweep requeue/recheck) must never be reachable without credentials.
  //
  // Local-dev story (explicit, not silent): either
  //   1. set ADMIN_API_KEY in your local .env (see .env.example) and send it
  //      as the `x-admin-key` header, or
  //   2. sign in as a user whose JWT carries role ADMIN.
  if (configuredKey && typeof adminKey === 'string' && adminKey === configuredKey) {
    return;
  }

  try {
    await request.jwtVerify();
    const authUser = getAuthenticatedUser(request);
    if (authUser?.role?.toUpperCase() === 'ADMIN') return;
  } catch {
    // Fall through to the forbidden response below.
  }

  void reply.status(403).send(errorResponse('ADMIN_REQUIRED', 'Admin authorization is required', 403));
}
