import { FastifyReply, FastifyRequest } from 'fastify';
import { KYCStatus, KYCTier } from '@kudi/types';
import { prisma } from '@kudi/database';
import { apiRoutes } from '@kudi/api-contracts';
import { LedgerService } from '../../services/ledgerService';
import { successResponse, errorResponse } from '../../utils/response';
import {
  verifyIdentityAndProvisionVirtualAccount,
  provisionVirtualAccountForExistingKyc,
  getIdentityProviderStatus,
  isSimulatedAllowed,
  VaProvisioningError
} from '../../lib/identityVerification';
import { isSumsubConfigured, ensureApplicant } from '../../lib/sumsub';
import {
  buildDojahWidgetUrl,
  createSumsubWebSdkSession,
  isDojahWidgetConfigured,
  loadKycSession,
  saveKycSession,
  clearKycSession,
  lookupDojahSession,
  lookupSumsubSession,
  sumsubWebSdkHtml,
  KYC_SESSION_TTL_MS,
  type KycSessionProviderName,
  type SessionCheckState
} from '../../lib/kycSession';
import { getAuthenticatedUser } from '../../utils/authGuards';

function splitName(fullName?: string | null) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  const [firstName = '', ...rest] = parts;
  return { firstName, lastName: rest.join(' ') };
}

function requestOrigin(request: FastifyRequest): string {
  const configured = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const host = request.headers.host;
  if (host) return `${request.protocol}://${host}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

export class KYCController {
  constructor(private ledgerService: LedgerService) {}

  public verifyID = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const { idNumber, idType, firstName, lastName, dob, email, phone } = request.body as {
      userId?: string;
      idNumber: string;
      idType: 'BVN' | 'NIN';
      firstName?: string;
      lastName?: string;
      dob?: string;
      email?: string;
      phone?: string;
    };

    const userId = authUser?.userId;
    if (!userId || !idNumber) {
      return reply.status(400).send(errorResponse('MISSING_FIELDS', 'Authenticated user and idNumber are required', 400));
    }

    try {
      const verification = await verifyIdentityAndProvisionVirtualAccount({
        userId,
        email,
        phone,
        checkType: idType,
        idNumber,
        firstName,
        lastName,
        dob,
      });

      if (!verification.verified) {
        return reply.status(400).send(
          errorResponse('KYC_VERIFICATION_FAILED', verification.message || 'Identity verification failed', 400)
        );
      }

      const assignedTier = KYCTier.TIER_2;
      this.ledgerService.updateUserKYC(userId, KYCStatus.VERIFIED, assignedTier);

      if (verification.virtualAccount) {
        try {
          await this.ledgerService.addVirtualAccount(userId, {
            accountNumber: verification.virtualAccount.accountNumber,
            accountName: verification.virtualAccount.accountName,
            bankName: verification.virtualAccount.bankName,
            bankCode: verification.virtualAccount.bankCode,
            currency: 'NGN',
            provider: verification.virtualAccount.provider,
          });
        } catch (persistErr) {
          const persistMessage = persistErr instanceof Error ? persistErr.message : String(persistErr);
          console.error('[KYC] Virtual account provisioned but not persisted to DB:', persistMessage);
        }
      }

      return successResponse({
        verified: true,
        tier: assignedTier,
        name: verification.name,
        dob: verification.dob,
        photo: verification.photo,
        provider: verification.provider,
        message: verification.message ?? 'KYC Approved & Virtual Account Active',
        virtualAccount: verification.virtualAccount,
      });
    } catch (err) {
      if (err instanceof VaProvisioningError) {
        return reply.status(502).send(
          errorResponse(
            'VA_PROVISIONING_FAILED',
            'Identity verified, but virtual account provisioning failed. Please retry verification.',
            502
          )
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send(errorResponse('KYC_ERROR', message, 500));
    }
  };

  public retryVirtualAccount = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const { userId } = request.params as { userId: string };

    if (!authUser || authUser.userId !== userId) {
      return reply.status(403).send(errorResponse('FORBIDDEN', 'You can only access your own account', 403));
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, phoneNumber: true, fullName: true, kycStatus: true }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send(errorResponse('DB_ERROR', message, 500));
    }

    if (!user || user.kycStatus !== KYCStatus.VERIFIED) {
      return reply
        .status(409)
        .send(errorResponse('KYC_REQUIRED', 'Complete identity verification before provisioning a virtual account', 409));
    }

    try {
      const virtualAccount = await provisionVirtualAccountForExistingKyc({
        userId,
        email: user.email || undefined,
        phone: user.phoneNumber || undefined,
        fullName: user.fullName || undefined
      });

      await this.ledgerService.addVirtualAccount(userId, {
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        bankName: virtualAccount.bankName,
        bankCode: virtualAccount.bankCode,
        currency: 'NGN',
        provider: virtualAccount.provider
      });

      const accounts = await this.ledgerService.getUserVirtualAccountsAsync(userId);
      return successResponse({ accounts, virtualAccount });
    } catch (err) {
      if (err instanceof VaProvisioningError) {
        return reply.status(502).send(errorResponse('VA_PROVISIONING_FAILED', err.message, 502));
      }
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send(errorResponse('VA_PROVISIONING_ERROR', message, 500));
    }
  };

  /**
   * Starts a hosted verification session: picks the active provider and
   * returns the URL the wallet must open in a WebView (null in dev
   * simulated mode, which completes on the first status poll).
   */
  public createKycSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const userId = authUser?.userId;
    if (!userId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication required', 401));
    }

    const body = (request.body ?? {}) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };

    try {
      const status = await getIdentityProviderStatus();
      let provider: KycSessionProviderName | null = status.effective;

      if (!provider) {
        if (!isSimulatedAllowed()) {
          return reply
            .status(503)
            .send(
              errorResponse(
                'KYC_PROVIDER_UNAVAILABLE',
                'No identity verification provider is configured. Add Dojah or Sumsub credentials in Settings.',
                503
              )
            );
        }
        provider = 'SIMULATED';
      }

      if (provider === 'DOJAH' && !isDojahWidgetConfigured()) {
        if (status.configured.SUMSUB && isSumsubConfigured()) {
          console.warn('[KYC] DOJAH_WIDGET_ID not set — falling back to SUMSUB hosted flow');
          provider = 'SUMSUB';
        } else {
          return reply
            .status(503)
            .send(
              errorResponse(
                'KYC_PROVIDER_MISCONFIGURED',
                'Dojah widget is not configured. Publish a flow in EasyOnboard and set DOJAH_WIDGET_ID, or switch provider in admin Settings.',
                503
              )
            );
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true, phoneNumber: true }
      });
      const parsedName = splitName(user?.fullName);
      const firstName = body.firstName?.trim() || parsedName.firstName || undefined;
      const lastName = body.lastName?.trim() || parsedName.lastName || undefined;
      const email = body.email?.trim() || user?.email || undefined;
      const phone = body.phone?.trim() || user?.phoneNumber || undefined;

      let url: string | null = null;
      const record: { provider: KycSessionProviderName; referenceId?: string; applicantId?: string; createdAt: number } = {
        provider,
        createdAt: Date.now()
      };

      if (provider === 'DOJAH') {
        // Unique per attempt so retries never read a stale verification record.
        record.referenceId = `kyc_${userId}_${Date.now().toString(36)}`;
        url = buildDojahWidgetUrl({ referenceId: record.referenceId, firstName, lastName, email });
      } else if (provider === 'SUMSUB') {
        const applicant = await ensureApplicant({ userId, email, firstName, lastName });
        record.applicantId = applicant.id;
        // Token is minted server-side when the authenticated WebView loads the
        // host page — never placed in a shareable/query-string URL.
        url = `${requestOrigin(request)}${apiRoutes.kyc.websdk}?lang=en`;
      }

      await saveKycSession(userId, record);

      return successResponse({
        provider,
        url,
        expiresAt: new Date(Date.now() + KYC_SESSION_TTL_MS).toISOString()
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[KYC] Failed to create verification session:', message);
      return reply.status(500).send(errorResponse('KYC_SESSION_ERROR', message, 500));
    }
  };

  /**
   * Polling endpoint: confirms the hosted-flow result server-side against
   * the provider, then completes KYC (tier upgrade + virtual account) on
   * approval. The client never decides the outcome.
   */
  public kycSessionStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const userId = authUser?.userId;
    if (!userId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication required', 401));
    }

    try {
      const session = await loadKycSession(userId);
      if (!session) {
        return successResponse({ status: 'none' });
      }

      let result: SessionCheckState;
      if (session.provider === 'SIMULATED') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true }
        });
        result = {
          state: 'approved',
          name: user?.fullName || 'Verified User',
          message: 'Verified identity (Simulated/Dev Mode — no provider configured)'
        };
      } else if (session.provider === 'DOJAH') {
        result = session.referenceId
          ? await lookupDojahSession(session.referenceId)
          : { state: 'pending', message: 'Verification has not started yet' };
      } else if (session.provider === 'SUMSUB') {
        result = await lookupSumsubSession(userId);
      } else {
        result = { state: 'pending' };
      }

      if (result.state === 'approved') {
        await clearKycSession(userId);

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true, email: true, phoneNumber: true }
        });
        const verifiedName = result.name || user?.fullName || 'Kudi User';
        const parsedName = splitName(verifiedName);

        this.ledgerService.updateUserKYC(userId, KYCStatus.VERIFIED, KYCTier.TIER_2);

        let virtualAccount: {
          accountNumber: string;
          accountName: string;
          bankName: string;
          bankCode: string;
          provider: 'SQUAD' | 'BACHS';
        } | null = null;
        let vaProvisioningFailed = false;
        let vaMessage: string | undefined;

        try {
          virtualAccount = await provisionVirtualAccountForExistingKyc({
            userId,
            email: user?.email || undefined,
            phone: user?.phoneNumber || undefined,
            fullName: verifiedName,
            firstName: parsedName.firstName || undefined,
            lastName: parsedName.lastName || undefined
          });
          try {
            await this.ledgerService.addVirtualAccount(userId, {
              accountNumber: virtualAccount.accountNumber,
              accountName: virtualAccount.accountName,
              bankName: virtualAccount.bankName,
              bankCode: virtualAccount.bankCode,
              currency: 'NGN',
              provider: virtualAccount.provider
            });
          } catch (persistErr) {
            const persistMessage = persistErr instanceof Error ? persistErr.message : String(persistErr);
            console.error('[KYC] Virtual account provisioned but not persisted to DB:', persistMessage);
          }
        } catch (err) {
          if (err instanceof VaProvisioningError) {
            // Identity is verified; the NGN account can be retried separately.
            vaProvisioningFailed = true;
            vaMessage = err.message;
            console.error('[KYC] VA provisioning failed after session approval:', err.message);
          } else {
            throw err;
          }
        }

        return successResponse({
          status: 'approved',
          provider: session.provider,
          tier: KYCTier.TIER_2,
          name: verifiedName,
          message: result.message ?? 'KYC Approved & Virtual Account Active',
          virtualAccount,
          vaProvisioningFailed,
          ...(vaMessage ? { vaMessage } : {})
        });
      }

      if (result.state === 'rejected' || result.state === 'abandoned') {
        await clearKycSession(userId);
      }

      return successResponse({
        status: result.state,
        provider: session.provider,
        message: result.message,
        name: result.name ?? null
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[KYC] Session status check failed:', message);
      return reply.status(500).send(errorResponse('KYC_STATUS_ERROR', message, 500));
    }
  };

  /**
   * Serves the Sumsub WebSDK host page to the wallet WebView. Requires the
   * authenticated user's JWT (Authorization header from the WebView) and an
   * active SUMSUB KYC session. The Sumsub access token is minted here
   * server-side and never appears in the URL.
   */
  public serveKycWebSdk = async (request: FastifyRequest, reply: FastifyReply) => {
    const html = (status: number, body: string) =>
      reply
        .status(status)
        .type('text/html; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .header('Permissions-Policy', 'camera=(self), microphone=(self)')
        .send(
          `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px">${body}</body></html>`
        );

    const authUser = getAuthenticatedUser(request);
    const userId = authUser?.userId;
    if (!userId) {
      return html(401, 'Sign in to start verification.');
    }
    if (!isSumsubConfigured()) {
      return html(503, 'Verification is temporarily unavailable.');
    }

    const session = await loadKycSession(userId);
    if (!session || session.provider !== 'SUMSUB') {
      return html(404, 'No active verification session. Start verification from the app first.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });
    const { token } = await createSumsubWebSdkSession({
      userId,
      email: user?.email || undefined
    });

    const { lang } = request.query as { lang?: string };
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .header('Permissions-Policy', 'camera=(self), microphone=(self)')
      .send(sumsubWebSdkHtml(token, lang));
  };
}
