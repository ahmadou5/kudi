import { create } from 'zustand';

export interface BankRecipient {
  id: string;
  name: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

export interface CryptoRecipient {
  id: string;
  address: string;
  chain: 'solana' | 'monad';
}

export interface RecipientsState {
  recentBank: BankRecipient[];
  savedBank: BankRecipient[];
  savedCrypto: CryptoRecipient[];
  /** Address handed back from the QR scanner when it was opened in "pick" mode. */
  scannedAddress: string | null;
  addRecentBank: (recipient: Omit<BankRecipient, 'id'>) => void;
  saveBank: (recipient: Omit<BankRecipient, 'id'>) => void;
  removeSavedBank: (id: string) => void;
  saveCrypto: (recipient: Omit<CryptoRecipient, 'id'>) => void;
  removeSavedCrypto: (id: string) => void;
  setScannedAddress: (address: string | null) => void;
}

const bankKey = (r: Pick<BankRecipient, 'accountNumber' | 'bankCode'>) => `${r.bankCode}:${r.accountNumber}`;

/**
 * In-memory recipient book for the send flows.
 * NOTE: not persisted across app restarts yet.
 */
export const useRecipientsStore = create<RecipientsState>()((set) => ({
  recentBank: [],
  savedBank: [],
  savedCrypto: [],
  scannedAddress: null,

  addRecentBank: (recipient) =>
    set((state) => {
      const rest = state.recentBank.filter((r) => bankKey(r) !== bankKey(recipient));
      return { recentBank: [{ ...recipient, id: bankKey(recipient) }, ...rest].slice(0, 20) };
    }),

  saveBank: (recipient) =>
    set((state) => {
      if (state.savedBank.some((r) => bankKey(r) === bankKey(recipient))) return state;
      return { savedBank: [{ ...recipient, id: bankKey(recipient) }, ...state.savedBank] };
    }),

  removeSavedBank: (id) => set((state) => ({ savedBank: state.savedBank.filter((r) => r.id !== id) })),

  saveCrypto: (recipient) =>
    set((state) => {
      const id = `${recipient.chain}:${recipient.address}`;
      if (state.savedCrypto.some((r) => r.id === id)) return state;
      return { savedCrypto: [{ ...recipient, id }, ...state.savedCrypto] };
    }),

  removeSavedCrypto: (id) => set((state) => ({ savedCrypto: state.savedCrypto.filter((r) => r.id !== id) })),

  setScannedAddress: (scannedAddress) => set({ scannedAddress }),
}));
