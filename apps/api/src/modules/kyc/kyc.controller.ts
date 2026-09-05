import { FastifyReply, FastifyRequest } from 'fastify';
import { KYCStatus, KYCTier } from '@kudi/types';
import { LedgerService } from '../../services/ledgerService';
import { successResponse, errorResponse } from '../../utils/response';
import { verifyIdentityAndProvisionVirtualAccount } from '../../lib/identityVerification';

export class KYCController {
  constructor(private ledgerService: LedgerService) {}

  public verifyID = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, idNumber, idType, firstName, lastName, dob, email, phone } = request.body as {
      userId: string;
      idNumber: string;
      idType: 'BVN' | 'NIN';
      firstName?: string;
      lastName?: string;
      dob?: string;
      email?: string;
      phone?: string;
    };

    if (!userId || !idNumber) {
      return reply.status(400).send(errorResponse('MISSING_FIELDS', 'userId and idNumber are required', 400));
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

      return successResponse({
        verified: true,
        tier: assignedTier,
        name: verification.name,
        dob: verification.dob,
        photo: verification.photo,
        message: verification.message ?? 'KYC Approved & Virtual Account Active',
        virtualAccount: verification.virtualAccount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send(errorResponse('KYC_ERROR', message, 500));
    }
  };
}
