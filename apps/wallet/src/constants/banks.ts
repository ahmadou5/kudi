import type { BankItem } from '../components/wallet/BankPickerModal';

/** Banks available for NGN bank transfers. */
export const NIGERIAN_BANKS: BankItem[] = [
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '057', name: 'Zenith Bank' },
  { code: '044', name: 'Access Bank' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '035', name: 'Wema Bank / ALAT' },
  { code: '232', name: 'Sterling Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '999992', name: 'OPay Digital Services' },
  { code: '999991', name: 'PalmPay' },
  { code: '50211', name: 'Kuda Microfinance Bank' },
];

/** Fintech banks whose account numbers are usually the customer's phone number (minus the leading 0). */
export const PHONE_NUMBER_BANK_CODES = ['999992', '999991', '50515', '50211'];
