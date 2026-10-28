import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@kudi/database';
import { successResponse, errorResponse } from '../../utils/response';
import { getAuthenticatedUser } from '../../utils/authGuards';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Attribute a signup to a referrer. Non-fatal by design — invalid codes, self-referrals
 * and races are swallowed so a bad referral never breaks account creation.
 */
export async function attributeReferral(rawCode: string | undefined, inviteeId: string): Promise<boolean> {
  const code = rawCode?.trim().toUpperCase();
  if (!code || !inviteeId) return false;
  try {
    const referralCode = await prisma.referralCode.findUnique({ where: { code } });
    if (!referralCode) {
      console.warn(`[Referral] Unknown referral code on signup: ${code}`);
      return false;
    }
    if (referralCode.userId === inviteeId) return false;
    const existing = await prisma.referral.findUnique({ where: { inviteeId }, select: { id: true } });
    if (existing) return false;
    await prisma.referral.create({
      data: { code, referrerId: referralCode.userId, inviteeId }
    });
    console.log(`[Referral] Attributed signup to referrer ${referralCode.userId} via code ${code}`);
    return true;
  } catch (err: any) {
    console.warn('[Referral] Attribution failed (non-fatal):', err?.message || err);
    return false;
  }
}

export class ReferralController {
  private async getOrCreateCode(userId: string): Promise<string | null> {
    const existing = await prisma.referralCode.findUnique({ where: { userId }, select: { code: true } });
    if (existing) return existing.code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      try {
        const created = await prisma.referralCode.create({ data: { userId, code } });
        return created.code;
      } catch (err: any) {
        if (err?.code === 'P2002') continue;
        console.warn('[Referral] Failed to create referral code:', err?.message || err);
        return null;
      }
    }
    return null;
  }

  public overview = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const userId = authUser?.userId;
    if (!userId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication is required', 401));
    }

    const code = await this.getOrCreateCode(userId);
    if (!code) {
      return reply
        .status(500)
        .send(errorResponse('REFERRAL_CODE_FAILED', 'Could not prepare your referral code', 500));
    }

    const invites = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        invitee: { select: { id: true, fullName: true, username: true, avatarUrl: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const invited = invites.map((r) => ({
      id: r.id,
      name: r.invitee?.fullName || r.invitee?.username || r.invitee?.email?.split('@')[0] || 'Kudi user',
      username: r.invitee?.username || undefined,
      avatarUrl: r.invitee?.avatarUrl || undefined,
      joinedAt: r.createdAt.toISOString()
    }));

    return successResponse({ code, invitedCount: invited.length, invited }, 'Referral overview retrieved');
  };
}
