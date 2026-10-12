import { CustodyProvider, CustodyTrack } from '@kudi/types';
import { SelfCustodyProvider } from './selfCustody';
import { PartnerCustodyProvider } from './partnerCustody';

export interface CustodyManagerConfig {
  privyAppId?: string;
  privyAppSecret?: string;
  defaultRpcUrl?: string;
  solanaRpcUrl?: string;
  partnerApiKey?: string;
  partnerApiUrl?: string;
  solanaUsdcMintAddress?: string;
  solanaTreasuryAddress?: string;
  solanaCaip2?: string;
  ausdTokenAddress?: string;
  monadChainId?: number;
  activeTrack?: CustodyTrack;
}

/**
 * CustodyManager — selects the active custody track/provider.
 *
 * Defaults to Track A (Privy self-custody). Track B (VASP partner) is used
 * only when explicitly selected via config or CUSTODY_TRACK env.
 */
export class CustodyManager {
  private selfCustody: SelfCustodyProvider;
  private partnerCustody?: PartnerCustodyProvider;
  private activeTrack: CustodyTrack;

  constructor(config: CustodyManagerConfig = {}) {
    this.selfCustody = new SelfCustodyProvider(
      config.privyAppId,
      config.privyAppSecret,
      config.defaultRpcUrl,
      config.solanaRpcUrl,
      config.solanaUsdcMintAddress,
      config.solanaTreasuryAddress,
      config.solanaCaip2,
      config.ausdTokenAddress,
      config.monadChainId
    );
    if (config.partnerApiKey) {
      this.partnerCustody = new PartnerCustodyProvider(
        config.partnerApiKey,
        config.partnerApiUrl
      );
    }
    const envTrack = process.env.CUSTODY_TRACK as CustodyTrack | undefined;
    this.activeTrack =
      config.activeTrack ??
      (envTrack === CustodyTrack.TRACK_B_PARTNER
        ? CustodyTrack.TRACK_B_PARTNER
        : CustodyTrack.TRACK_A_SELF_CUSTODY);
  }

  public getActiveTrack(): CustodyTrack {
    return this.activeTrack;
  }

  public getActiveProvider(): CustodyProvider {
    if (this.activeTrack === CustodyTrack.TRACK_B_PARTNER) {
      if (!this.partnerCustody) {
        throw new Error('[CustodyManager] Track B selected but no partner API key configured');
      }
      return this.partnerCustody;
    }
    return this.selfCustody;
  }
}
