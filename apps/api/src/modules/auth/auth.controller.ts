import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { LedgerService } from '../../services/ledgerService';
import { successResponse, errorResponse } from '../../utils/response';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { verifyPin } from '../../utils/hash';

export class AuthController {
  constructor(
    private custodyManager: CustodyManager,
    private ledgerService: LedgerService
  ) {}

  public authenticatePrivy = async (request: FastifyRequest, reply: FastifyReply) => {
    const { privyToken, privyUserId, email, phoneNumber } = request.body as {
      privyToken?: string;
      privyUserId: string;
      email?: string;
      phoneNumber?: string;
    };

    if (!privyUserId && !email && !phoneNumber) {
      return reply.status(400).send(errorResponse('INVALID_AUTH_PAYLOAD', 'Privy user ID, email, or phone number required'));
    }

    // Lookup user or register new user
    let user = this.ledgerService.findUserByPrivyOrEmail(privyUserId, email, phoneNumber);
    let userId = user ? user.id : `usr_${Date.now()}`;

    if (!user) {
      user = this.ledgerService.registerUser(userId, phoneNumber, email, privyUserId);
    }

    // Ensure wallets are generated for the user
    const custodyProvider = this.custodyManager.getActiveProvider();
    const solanaWallet = await custodyProvider.generateWallet(userId, 'solana');
    const monadWallet = await custodyProvider.generateWallet(userId, 'monad-testnet');

    // Sign Kudi session JWT tokens using fastify jwt
    const payload = { userId: user.id, email: user.email, phoneNumber: user.phoneNumber };
    const accessToken = signAccessToken(request.server, payload);
    const refreshToken = signRefreshToken(request.server, payload);

    return successResponse({
      user,
      wallets: [solanaWallet, monadWallet],
      accessToken,
      refreshToken
    }, 'Authentication successful');
  };

  public refreshToken = async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) {
      return reply.status(400).send(errorResponse('MISSING_TOKEN', 'Refresh token required'));
    }

    try {
      const decoded = request.server.jwt.verify<{ userId: string; email?: string; phoneNumber?: string }>(refreshToken);
      const newAccessToken = signAccessToken(request.server, {
        userId: decoded.userId,
        email: decoded.email,
        phoneNumber: decoded.phoneNumber
      });
      return successResponse({ accessToken: newAccessToken }, 'Token refreshed successfully');
    } catch (err) {
      return reply.status(401).send(errorResponse('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token'));
    }
  };

  public registerUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const { phoneNumber, email } = request.body as { phoneNumber: string; email: string };
    const userId = `usr_${Date.now()}`;

    const custodyProvider = this.custodyManager.getActiveProvider();
    const solanaWallet = await custodyProvider.generateWallet(userId, 'solana');
    const monadWallet = await custodyProvider.generateWallet(userId, 'monad-testnet');

    const user = this.ledgerService.registerUser(userId, phoneNumber, email);
    const payload = { userId: user.id, email: user.email, phoneNumber: user.phoneNumber };
    const accessToken = signAccessToken(request.server, payload);
    const refreshToken = signRefreshToken(request.server, payload);

    return successResponse({
      user,
      wallets: [solanaWallet, monadWallet],
      accessToken,
      refreshToken
    });
  };

  public setPin = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, pin } = request.body as { userId: string; pin: string };
    if (!pin || pin.length < 4) {
      return reply.status(400).send(errorResponse('INVALID_PIN', 'PIN must be at least 4 digits'));
    }
    this.ledgerService.setUserPin(userId, pin);
    return successResponse(null, 'Transaction PIN set successfully');
  };

  public verifyPin = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, pin } = request.body as { userId: string; pin: string };
    const user = this.ledgerService.getUser(userId);
    if (!user) {
      return reply.status(404).send(errorResponse('USER_NOT_FOUND', 'User not found'));
    }
    const isValid = verifyPin(pin, user.pinHash);
    if (!isValid) {
      return reply.status(401).send(errorResponse('INVALID_PIN', 'Incorrect PIN'));
    }
    return successResponse({ verified: true }, 'PIN verified successfully');
  };
}

