import { create } from 'zustand';

interface DepositRequestState {
  /** Monotonic counter — every increment is one "open the deposit sheet" request. */
  request: number;
  requestDeposit: () => void;
}

/**
 * Lets any screen ask the Home balance carousel to open its deposit sheet.
 * The carousel owns the sheet UI and picks the sheet that matches the card
 * currently on screen (On-Chain / NGN / USD / EUR).
 */
export const useDepositRequestStore = create<DepositRequestState>((set) => ({
  request: 0,
  requestDeposit: () => set((state) => ({ request: state.request + 1 }))
}));
