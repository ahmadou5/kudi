import { CustodyProvider, CustodyTrack, DepositWallet } from '@kudi/types';

export class PartnerCustodyProvider implements CustodyProvider {
  public readonly track = CustodyTrack.TRACK_B_PARTNER;
  public readonly name = 'VASP Partner Custody (Busha / Quidax - Track B)';

  private partnerApiKey: string;
  private partnerApiUrl: string;

  constructor(partnerApiKey: string, partnerApiUrl: string = 'https://api.busha.co/v1') {
    if (!partnerApiKey) {
      throw new Error('[PartnerCustodyProvider] Partner API key is required');
    }
    this.partnerApiKey = partnerApiKey;
    this.partnerApiUrl = partnerApiUrl;
  }

  async generateWallet(userId: string, chain: string): Promise<DepositWallet> {
    // Call Busha / Quidax VASP Partner API to issue deposit address
    const res = await fetch(`${this.partnerApiUrl}/addresses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.partnerApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currency: chain.includes('solana') ? 'USDC' : 'AUSD',
        user_id: userId
      })
    });

    if (!res.ok) {
      throw new Error(`[PartnerCustody] Failed to generate wallet: ${res.status} ${await res.text().catch(() => '')}`);
    }

    const data = await res.json();
    return {
      address: data.address,
      chain,
      metadata: {
        partnerAddressId: data.id,
        createdAt: new Date().toISOString()
      }
    };
  }

  async getWalletBalance(address: string, chain: string, tokenAddress?: string): Promise<string> {
    try {
      const res = await fetch(`${this.partnerApiUrl}/wallets/${address}/balance`, {
        headers: {
          Authorization: `Bearer ${this.partnerApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const rawBalance = data.balance || data.available_balance || data.amount || '0.00';
        return Number(rawBalance).toFixed(2);
      }
    } catch (err) {
      console.warn('VASP Partner Balance query failed:', err);
    }
    throw new Error('[PartnerCustody] Failed to get wallet balance from VASP partner');
  }

  async verifyDepositTransaction(txHash: string, chain: string): Promise<{
    confirmed: boolean;
    amount: string;
    sender: string;
    tokenAddress: string;
    blockNumber?: number;
  }> {
    try {
      const res = await fetch(`${this.partnerApiUrl}/transactions/${txHash}`, {
        headers: {
          Authorization: `Bearer ${this.partnerApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        return {
          confirmed: data.status === 'completed' || data.status === 'confirmed' || data.status === 'success',
          amount: String(data.amount || '0.00'),
          sender: data.sender || data.from || 'VASP_Partner_Sender',
          tokenAddress: data.currency || data.token_address || (chain.includes('solana') ? 'USDC' : 'AUSD'),
          blockNumber: data.block_number || data.slot
        };
      }
    } catch (err) {
      console.warn('VASP Partner Tx verification query failed:', err);
    }

    // Fail closed: never synthesize a confirmed deposit. Callers must
    // handle confirmed:false explicitly instead of crediting fake amounts.
    return {
      confirmed: false,
      amount: '0.00',
      sender: '',
      tokenAddress: '',
      blockNumber: undefined
    };
  }
}
