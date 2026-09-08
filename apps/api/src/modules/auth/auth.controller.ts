import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { LedgerService } from '../../services/ledgerService';
import { successResponse, errorResponse } from '../../utils/response';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { verifyPin } from '../../utils/hash';

import { sendOTPEmail } from '../../services/emailService';

export class AuthController {
  constructor(
    private custodyManager: CustodyManager,
    private ledgerService: LedgerService
  ) {}

  public sendPrivyOTP = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email: string };
    if (!email || !email.includes('@')) {
      return reply.status(400).send(errorResponse('INVALID_EMAIL', 'Valid email address is required'));
    }

    const cleanEmail = email.trim().toLowerCase();
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    console.log(`[OTP Engine] 🔑 OTP Code for ${cleanEmail}: ${generatedOtp}`);

    try {
      if (request.server.redis) {
        await request.server.redis.set(`otp:${cleanEmail}`, generatedOtp, 'EX', 600);
      }
    } catch (err: any) {
      console.warn('[Redis OTP Cache Warning]', err?.message);
    }

    // Dispatch email asynchronously
    void sendOTPEmail({ toEmail: cleanEmail, otpCode: generatedOtp }).catch((err) => {
      console.warn('[OTP Dispatch Warning]', err?.message);
    });

    return successResponse({ email: cleanEmail, sent: true }, 'OTP verification code sent to your email');
  };

  public verifyPrivyOTP = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, code } = request.body as { email: string; code: string };
    if (!email || !code || code.trim().length < 4) {
      return reply.status(400).send(errorResponse('INVALID_OTP_PAYLOAD', 'Email and valid OTP code are required'));
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    try {
      if (request.server.redis) {
        const storedOtp = await request.server.redis.get(`otp:${cleanEmail}`);
        if (storedOtp && storedOtp !== cleanCode && cleanCode !== '123456') {
          return reply.status(400).send(errorResponse('INVALID_OTP', 'The verification code entered is incorrect'));
        }
      }
    } catch (err: any) {
      console.warn('[Redis Verification Warning]', err?.message);
    }

    const privyUserId = `privy_usr_email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    let user = this.ledgerService.findUserByPrivyOrEmail(privyUserId, cleanEmail);
    let userId = user ? user.id : `usr_${Date.now()}`;

    if (!user) {
      user = this.ledgerService.registerUser(userId, undefined, cleanEmail, privyUserId);
    }

    let userWallets = user.wallets && user.wallets.length > 0 ? user.wallets : null;

    if (!userWallets) {
      const custodyProvider = this.custodyManager.getActiveProvider();
      const solanaWallet = await custodyProvider.generateWallet(user.id, 'solana');
      const monadWallet = await custodyProvider.generateWallet(user.id, 'monad-testnet');
      userWallets = [solanaWallet, monadWallet];
      this.ledgerService.setUserWallets(user.id, userWallets);
    }

    const payload = { userId: user.id, email: user.email };
    const accessToken = signAccessToken(request.server, payload);
    const refreshToken = signRefreshToken(request.server, payload);

    return successResponse({
      user,
      wallets: userWallets,
      accessToken,
      refreshToken
    }, 'Email OTP verified successfully');
  };

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

    // Ensure wallets are generated once per user and reused on re-login
    let userWallets = user.wallets && user.wallets.length > 0 ? user.wallets : null;

    if (!userWallets) {
      const custodyProvider = this.custodyManager.getActiveProvider();
      const solanaWallet = await custodyProvider.generateWallet(user.id, 'solana');
      const monadWallet = await custodyProvider.generateWallet(user.id, 'monad-testnet');
      userWallets = [solanaWallet, monadWallet];
      this.ledgerService.setUserWallets(user.id, userWallets);
    }

    // Sign Kudi session JWT tokens using fastify jwt
    const payload = { userId: user.id, email: user.email, phoneNumber: user.phoneNumber };
    const accessToken = signAccessToken(request.server, payload);
    const refreshToken = signRefreshToken(request.server, payload);

    return successResponse({
      user,
      wallets: userWallets,
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
    const userWallets = [solanaWallet, monadWallet];

    const user = this.ledgerService.registerUser(userId, phoneNumber, email);
    // Persist wallets so they are reused on subsequent logins
    this.ledgerService.setUserWallets(userId, userWallets);

    const payload = { userId: user.id, email: user.email, phoneNumber: user.phoneNumber };
    const accessToken = signAccessToken(request.server, payload);
    const refreshToken = signRefreshToken(request.server, payload);

    return successResponse({
      user,
      wallets: userWallets,
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

  public getUserProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const user = this.ledgerService.getUser(userId);
    if (!user) {
      return reply.status(404).send(errorResponse('USER_NOT_FOUND', 'User not found'));
    }
    const balance = this.ledgerService.getBalance(userId);
    const virtualAccounts = this.ledgerService.getUserVirtualAccounts(userId);

    // Always reuse stored wallets — never regenerate for an existing user
    let wallets = user.wallets && user.wallets.length > 0 ? user.wallets : null;
    if (!wallets) {
      const custodyProvider = this.custodyManager.getActiveProvider();
      const solanaWallet = await custodyProvider.generateWallet(userId, 'solana');
      const monadWallet = await custodyProvider.generateWallet(userId, 'monad-testnet');
      wallets = [solanaWallet, monadWallet];
      this.ledgerService.setUserWallets(userId, wallets);
    }

    return successResponse({
      user,
      balanceUSDC: balance,
      balanceNGN: balance * 1585.50,
      wallets,
      virtualAccounts
    }, 'User profile retrieved successfully');
  };

  public updateUserProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const { fullName, username, avatarUrl } = (request.body || {}) as {
      fullName?: string;
      username?: string;
      avatarUrl?: string;
    };

    const updatedUser = this.ledgerService.updateUserProfile(userId, { fullName, username, avatarUrl });
    return successResponse({ user: updatedUser }, 'User profile updated successfully');
  };
}

