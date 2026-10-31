import { FastifyReply, FastifyRequest } from 'fastify';
import { KYCStatus, KYCTier } from '@kudi/types';
import { prisma } from '@kudi/database';
import { LedgerService } from '../../services/ledgerService';
import { successResponse, errorResponse } from '../../utils/response';
import {
  verifyIdentityAndProvisionVirtualAccount,
  provisionVirtualAccountForExistingKyc,
  VaProvisioningError
} from '../../lib/identityVerification';
import { getAuthenticatedUser } from '../../utils/authGuards';

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
}
