import { CustodyProvider, CustodyTrack } from '@kudi/types';
import { SelfCustodyProvider } from './selfCustody';
import { PartnerCustodyProvider } from './partnerCustody';

export * from './selfCustody';
export * from './partnerCustody';
export * from './evmListener';
export * from './solanaListener';
export * from '@kudi/chains-core';

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
}

export class CustodyManager {
  private activeTrack: CustodyTrack = CustodyTrack.TRACK_A_SELF_CUSTODY;
  private selfCustodyProvider: SelfCustodyProvider;
  private partnerCustodyProvider: PartnerCustodyProvider;

  constructor(config: CustodyManagerConfig = {}) {
    this.selfCustodyProvider = new SelfCustodyProvider(
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
    this.partnerCustodyProvider = new PartnerCustodyProvider(config.partnerApiKey, config.partnerApiUrl);
  }

  public getActiveProvider(): CustodyProvider {
    if (this.activeTrack === CustodyTrack.TRACK_A_SELF_CUSTODY) {
      return this.selfCustodyProvider;
    }
    return this.partnerCustodyProvider;
  }

  public getActiveTrack(): CustodyTrack {
    return this.activeTrack;
  }

  public setTrack(track: CustodyTrack): void {
    this.activeTrack = track;
  }
}
