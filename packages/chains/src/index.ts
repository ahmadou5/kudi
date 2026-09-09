import { CustodyProvider, CustodyTrack } from '@kudi/types';
import { SelfCustodyProvider } from './selfCustody';
import { PartnerCustodyProvider } from './partnerCustody';

export * from './selfCustody';
export * from './partnerCustody';
export * from './evmListener';
export * from './solanaListener';
export * from './addressValidator';
export * from './cryptoWithdrawalQueue';

export class CustodyManager {
  private activeTrack: CustodyTrack = CustodyTrack.TRACK_A_SELF_CUSTODY;
  private selfCustodyProvider: SelfCustodyProvider;
  private partnerCustodyProvider: PartnerCustodyProvider;

  constructor() {
    this.selfCustodyProvider = new SelfCustodyProvider();
    this.partnerCustodyProvider = new PartnerCustodyProvider();
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
