import type { BankItem } from '../components/wallet/BankPickerModal';

/**
 * Comprehensive list of CBN-licensed Nigerian banks and major MFBs/Fintechs.
 * Names use the commonly-known brand names (how Nigerians refer to each bank).
 * `slug` maps to the logo CDN at:
 *   https://cdn.jsdelivr.net/gh/supermx1/nigerian-banks-api@main/logos/{slug}.png
 */
export const NIGERIAN_BANKS: BankItem[] = [
  // ── Tier 1 Commercial Banks ──────────────────────────────────────────────
  { code: '011', name: 'First Bank',                slug: 'first-bank-of-nigeria' },
  { code: '033', name: 'UBA',                       slug: 'united-bank-for-africa' },
  { code: '044', name: 'Access Bank',               slug: 'access-bank' },
  { code: '057', name: 'Zenith Bank',               slug: 'zenith-bank' },
  { code: '058', name: 'GTBank',                    slug: 'gtbank' },

  // ── Tier 2 Commercial Banks ──────────────────────────────────────────────
  { code: '023', name: 'Citibank',                  slug: 'citibank-nigeria' },
  { code: '032', name: 'Union Bank',                slug: 'union-bank-of-nigeria' },
  { code: '035', name: 'Wema Bank',                 slug: 'wema-bank' },
  { code: '050', name: 'Ecobank',                   slug: 'ecobank-nigeria' },
  { code: '063', name: 'Access Bank (Diamond)',     slug: 'access-bank' },
  { code: '068', name: 'Standard Chartered',        slug: 'standard-chartered-bank-nigeria' },
  { code: '070', name: 'Fidelity Bank',             slug: 'fidelity-bank' },
  { code: '076', name: 'Polaris Bank',              slug: 'polaris-bank' },
  { code: '082', name: 'Keystone Bank',             slug: 'keystone-bank' },
  { code: '101', name: 'Providus Bank',             slug: 'providus-bank' },
  { code: '214', name: 'FCMB',                      slug: 'first-city-monument-bank' },
  { code: '215', name: 'Unity Bank',                slug: 'unity-bank' },
  { code: '221', name: 'Stanbic IBTC',              slug: 'stanbic-ibtc-bank' },
  { code: '232', name: 'Sterling Bank',             slug: 'sterling-bank' },

  // ── Non-Interest / Islamic Banks ─────────────────────────────────────────
  { code: '301', name: 'Jaiz Bank',                 slug: 'jaiz-bank' },
  { code: '302', name: 'TAJ Bank',                  slug: 'taj-bank' },
  { code: '304', name: 'Lotus Bank',                slug: 'lotus-bank' },

  // ── Other Licensed Commercial Banks ──────────────────────────────────────
  { code: '100', name: 'SunTrust Bank',             slug: 'suntrust-bank-nigeria' },
  { code: '305', name: 'Optimus Bank',              slug: 'optimus-bank' },
  { code: '307', name: 'Globus Bank',               slug: 'globus-bank' },
  { code: '315', name: 'Premium Trust Bank',        slug: 'premium-trust-bank' },
  { code: '318', name: 'Titan Trust Bank',          slug: 'titan-trust-bank' },

  // ── Digital Banks & Fintechs ─────────────────────────────────────────────
  { code: '50211',  name: 'Kuda Bank',              slug: 'kuda-bank' },
  { code: '50515',  name: 'Moniepoint MFB',         slug: 'moniepoint-mfb-ng' },
  { code: '999992', name: 'OPay',                   slug: 'opay' },
  { code: '999991', name: 'PalmPay',                slug: 'palmpay' },
  { code: '50126',  name: 'Carbon',                 slug: 'carbon' },
  { code: '50162',  name: 'FairMoney',              slug: 'fairmoney' },
  { code: '50304',  name: 'VFD MFB',                slug: 'vfd-microfinance-bank' },
  { code: '50767',  name: 'Raven Bank',             slug: null },
  { code: '120001', name: '9PSB',                   slug: '9-payment-service-bank' },
  { code: '50800',  name: 'Bankly MFB',             slug: null },
  { code: '090270', name: 'AB Microfinance Bank',   slug: null },
  { code: '090366', name: 'Parallex MFB',           slug: null },
  { code: '090290', name: 'Cowry Asset MFB',        slug: null },
  { code: '090616', name: 'Paga',                   slug: 'paga' },
];

/**
 * Fintech banks whose account numbers are typically the customer's
 * phone number (without the leading 0).
 */
export const PHONE_NUMBER_BANK_CODES: string[] = [
  '999992', // OPay
  '999991', // PalmPay
  '50515',  // Moniepoint
  '50211',  // Kuda
  '120001', // 9PSB
];
