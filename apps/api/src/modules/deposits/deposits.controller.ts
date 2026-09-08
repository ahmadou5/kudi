import { FastifyReply, FastifyRequest } from 'fastify';
import { DepositService } from '../../services/depositService';
import { SweepService } from '../../services/sweepService';
import { SolanaListener } from '@kudi/chains';

export class DepositsController {
  constructor(
    private depositService: DepositService,
    private sweepService: SweepService
  ) {}

  /**
   * POST /api/v1/deposits/rescan
   * Triggers an immediate on-chain USDC scan for all registered users.
   * Useful for testing without waiting for the 10-second polling interval.
   */
  public rescan = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await this.depositService.rescanNow();
      return reply.send({
        success: true,
        message: 'Deposit rescan complete',
        ...result
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err?.message });
    }
  };

  /**
   * GET /api/v1/deposits/balance/:address
   * Returns the real on-chain USDC balance for any Solana wallet address.
   * Useful for debugging — shows what's actually on-chain vs the ledger.
   */
  public getOnChainBalance = async (request: FastifyRequest, reply: FastifyReply) => {
    const { address } = request.params as { address: string };
    const listener = new SolanaListener();
    try {
      const balance = await listener.getSolanaUSDCBalance(address);
      return reply.send({ address, onChainUSDC: balance });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err?.message });
    }
  };

  /**
   * GET /api/v1/deposits/treasury
   * Returns the current USDC balance in Kudi's treasury wallet.
   * This is the float that backs all NGN payouts via Paystack/Monnify.
   */
  public getTreasuryBalance = async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const balance = await this.sweepService.getTreasuryBalance();
      const address = this.sweepService.treasuryAddress || 'NOT_CONFIGURED';
      return reply.send({
        treasuryAddress: address,
        onChainUSDC: balance,
        configured: !!this.sweepService.treasuryAddress
      });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err?.message });
    }
  };
}
