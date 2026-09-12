import { SESSION_COOKIE } from './session';

function getAuthToken(): string | null {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(new RegExp('(^| )' + SESSION_COOKIE + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
  return null;
}

export type KpiCard = {
  label: string;
  value: string;
  delta: string;
  tone: 'primary' | 'success' | 'warning' | 'muted';
  description?: string;
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  kycTier: 'UNVERIFIED' | 'TIER_1' | 'TIER_2';
  kycStatus: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  balanceUSDC: number;
  totalSpendNGN: number;
  spendCount: number;
  wallets: Array<{ chain: string; address: string }>;
  virtualAccounts: Array<{ bankName: string; accountNumber: string; accountName: string }>;
  createdAt: string;
  lastActive: string;
};

export type AdminSpendTransaction = {
  id: string;
  reference: string;
  userId: string;
  userName: string;
  userEmail: string;
  amountUSDC: number;
  exchangeRateNGN: number;
  amountNGN: number;
  feeNGN: number;
  recipientBankName: string;
  recipientBankCode: string;
  recipientAccountNumber: string;
  recipientAccountName: string;
  payoutProvider: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  failureReason?: string;
  createdAt: string;
};

export type AdminDeposit = {
  id: string;
  userId: string;
  userName: string;
  chain: 'Monad Testnet' | 'Solana' | 'Polygon';
  txHash: string;
  token: 'AUSD' | 'USDC';
  amount: number;
  confirmations: number;
  status: 'CONFIRMED' | 'PENDING';
  createdAt: string;
};

export type AdminKycQueueItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  bvn: string;
  nin: string;
  requestedTier: 'TIER_1' | 'TIER_2';
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  livenessConfidenceScore: number;
  documentType: string;
  submittedAt: string;
};

export type AdminPayoutRail = {
  id: 'PAYSTACK' | 'MONNIFY' | 'SQUAD';
  name: string;
  active: boolean;
  balanceNGN: number;
  latencyMs: number;
  successRate: number;
  supportedRails: string[];
};

export type AdminRateState = {
  currentRateNGN: number;
  blendedMarketRate: number;
  binanceP2PRate: number;
  bybitP2PRate: number;
  spreadMarginPct: number;
  isOverridden: boolean;
  overrideExpiry?: string;
  lastPolledAt: string;
};

export type AdminChainItem = {
  id: string;
  name: string;
  type: 'EVM' | 'SOLANA';
  token: string;
  enabled: boolean;
  rpcUrl: string;
  contractAddress: string;
  confirmationThreshold: number;
};

export type AdminNotification = {
  id: string;
  title: string;
  body: string;
  channel: 'PUSH' | 'EMAIL' | 'IN_APP';
  audience: 'ALL' | 'TIER_2' | 'ACTIVE_DEPOSITORS';
  sentAt: string;
  deliveredCount: number;
};

export type AdminSettings = {
  maintenanceMode: boolean;
  autoFailoverEnabled: boolean;
  maxDailySpendLimitNGN: number;
  rateSpreadToleranceBps: number;
  health: {
    fastifyApi: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    postgresPrisma: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    redisBullmq: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    monadMetropolisRpc: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    solanaRpc: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  };
  auditLogs: Array<{ id: string; adminEmail: string; action: string; details: string; timestamp: string }>;
};

export type AdminDashboardSnapshot = {
  kpis: KpiCard[];
  volumeChart: Array<{ label: string; usdc: number; ngn: number }>;
  recentTransactions: AdminSpendTransaction[];
  recentDeposits: AdminDeposit[];
  rateState: AdminRateState;
  payoutRails: AdminPayoutRail[];
  custodyTrack: string;
  usersSummary: { total: number; tier1: number; tier2: number; verifiedKycPct: number };
};

const apiUrl = process.env.KUDI_API_URL ?? 'http://localhost:4000';

async function adminFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const token = getAuthToken();
    const response = await fetch(`${apiUrl}/api/v1/admin${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      cache: 'no-store'
    });

    if (response.ok) {
      const payload = await response.json();
      if (payload?.data) return payload.data as T;
      if (payload) return payload as T;
    }
  } catch {
    // API not reachable or offline, use rich fallback data
  }
  return fallback;
}

// ─── MOCK / FALLBACK DATASETS ──────────────────────────────────────────

const fallbackKpis: KpiCard[] = [
  { label: '24h Processed Volume', value: '₦48,250,000', delta: '+18.4%', tone: 'primary', description: '$30,441 USDC disbursed to NGN' },
  { label: 'Active Custody Wallets', value: '1,428', delta: '+12.1%', tone: 'success', description: 'Monad Metropolis + Solana SPL' },
  { label: 'Live Exchange Rate', value: '₦1,585.50', delta: '+0.4%', tone: 'warning', description: 'Blended Binance & Bybit P2P' },
  { label: 'Active Payout Rail', value: 'Paystack NIP', delta: '99.8%', tone: 'muted', description: 'Failover: Monnify → Squad' }
];

const fallbackVolumeChart = [
  { label: 'Mon', usdc: 14200, ngn: 22507000 },
  { label: 'Tue', usdc: 18900, ngn: 29956500 },
  { label: 'Wed', usdc: 23100, ngn: 36613500 },
  { label: 'Thu', usdc: 28500, ngn: 45172500 },
  { label: 'Fri', usdc: 34200, ngn: 54207000 },
  { label: 'Sat', usdc: 39800, ngn: 63083000 },
  { label: 'Sun', usdc: 48250, ngn: 76476250 }
];

const fallbackTransactions: AdminSpendTransaction[] = [
  {
    id: 'sp_01',
    reference: 'KUDI_SPEND_1725423120001',
    userId: 'usr_01',
    userName: 'Chinedu Okafor',
    userEmail: 'chinedu@metropolis.dev',
    amountUSDC: 120.0,
    exchangeRateNGN: 1585.5,
    amountNGN: 190260.0,
    feeNGN: 50.0,
    recipientBankName: 'Access Bank PLC',
    recipientBankCode: '044',
    recipientAccountNumber: '0691234567',
    recipientAccountName: 'Chinedu Emmanuel Okafor',
    payoutProvider: 'PAYSTACK',
    status: 'SUCCESS',
    createdAt: '2026-09-12 02:45:10'
  },
  {
    id: 'sp_02',
    reference: 'KUDI_SPEND_1725423120002',
    userId: 'usr_02',
    userName: 'Amina Bello',
    userEmail: 'amina.bello@techmail.ng',
    amountUSDC: 450.0,
    exchangeRateNGN: 1585.5,
    amountNGN: 713475.0,
    feeNGN: 50.0,
    recipientBankName: 'Guaranty Trust Bank',
    recipientBankCode: '058',
    recipientAccountNumber: '0129876543',
    recipientAccountName: 'Amina Hadiza Bello',
    payoutProvider: 'MONNIFY',
    status: 'SUCCESS',
    createdAt: '2026-09-12 02:18:22'
  },
  {
    id: 'sp_03',
    reference: 'KUDI_SPEND_1725423120003',
    userId: 'usr_03',
    userName: 'Femi Adeleke',
    userEmail: 'femi.adeleke@monadbuild.xyz',
    amountUSDC: 85.0,
    exchangeRateNGN: 1585.5,
    amountNGN: 134767.5,
    feeNGN: 50.0,
    recipientBankName: 'Kuda Bank',
    recipientBankCode: '50211',
    recipientAccountNumber: '2001122334',
    recipientAccountName: 'Femi Olumide Adeleke',
    payoutProvider: 'PAYSTACK',
    status: 'PENDING',
    createdAt: '2026-09-12 01:54:05'
  },
  {
    id: 'sp_04',
    reference: 'KUDI_SPEND_1725423120004',
    userId: 'usr_04',
    userName: 'Zainab Ibrahim',
    userEmail: 'zainab.ib@horizon.africa',
    amountUSDC: 2000.0,
    exchangeRateNGN: 1585.5,
    amountNGN: 3171000.0,
    feeNGN: 100.0,
    recipientBankName: 'Zenith Bank PLC',
    recipientBankCode: '057',
    recipientAccountNumber: '2119988776',
    recipientAccountName: 'Zainab Fatima Ibrahim',
    payoutProvider: 'SQUAD',
    status: 'SUCCESS',
    createdAt: '2026-09-11 23:30:18'
  },
  {
    id: 'sp_05',
    reference: 'KUDI_SPEND_1725423120005',
    userId: 'usr_05',
    userName: 'David Adeleke',
    userEmail: 'david.a@kudi.demo',
    amountUSDC: 50.0,
    exchangeRateNGN: 1585.5,
    amountNGN: 79275.0,
    feeNGN: 50.0,
    recipientBankName: 'United Bank for Africa',
    recipientBankCode: '033',
    recipientAccountNumber: '1023456789',
    recipientAccountName: 'David Adeleke',
    payoutProvider: 'PAYSTACK',
    status: 'FAILED',
    failureReason: 'Destination bank network timeout during NIP transfer settlement',
    createdAt: '2026-09-11 21:12:00'
  }
];

const fallbackDeposits: AdminDeposit[] = [
  {
    id: 'dep_01',
    userId: 'usr_01',
    userName: 'Chinedu Okafor',
    chain: 'Monad Testnet',
    txHash: '0x8f2a9c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
    token: 'AUSD',
    amount: 150.0,
    confirmations: 24,
    status: 'CONFIRMED',
    createdAt: '2026-09-12 02:30:00'
  },
  {
    id: 'dep_02',
    userId: 'usr_02',
    userName: 'Amina Bello',
    chain: 'Solana',
    txHash: '5K9vH...qN7x8z',
    token: 'USDC',
    amount: 500.0,
    confirmations: 32,
    status: 'CONFIRMED',
    createdAt: '2026-09-12 01:50:12'
  },
  {
    id: 'dep_03',
    userId: 'usr_03',
    userName: 'Femi Adeleke',
    chain: 'Monad Testnet',
    txHash: '0x4b7c1e9a2d3f...5f6a',
    token: 'AUSD',
    amount: 100.0,
    confirmations: 12,
    status: 'CONFIRMED',
    createdAt: '2026-09-12 01:30:45'
  },
  {
    id: 'dep_04',
    userId: 'usr_04',
    userName: 'Zainab Ibrahim',
    chain: 'Polygon',
    txHash: '0x7e2d9f...1a4c',
    token: 'USDC',
    amount: 2500.0,
    confirmations: 64,
    status: 'CONFIRMED',
    createdAt: '2026-09-11 22:15:30'
  }
];

const fallbackUsers: AdminUser[] = [
  {
    id: 'usr_01',
    fullName: 'Chinedu Okafor',
    email: 'chinedu@metropolis.dev',
    phoneNumber: '+2348031234567',
    kycTier: 'TIER_2',
    kycStatus: 'VERIFIED',
    balanceUSDC: 342.5,
    totalSpendNGN: 1850000.0,
    spendCount: 14,
    wallets: [
      { chain: 'Monad Testnet', address: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b' },
      { chain: 'Solana', address: '6Z2k...mQ8p' }
    ],
    virtualAccounts: [
      { bankName: 'Wema Bank (Kudi VA)', accountNumber: '8031234567', accountName: 'Kudi/Chinedu Okafor' }
    ],
    createdAt: '2026-08-15',
    lastActive: '10 mins ago'
  },
  {
    id: 'usr_02',
    fullName: 'Amina Bello',
    email: 'amina.bello@techmail.ng',
    phoneNumber: '+2348129876543',
    kycTier: 'TIER_2',
    kycStatus: 'VERIFIED',
    balanceUSDC: 1250.0,
    totalSpendNGN: 5400000.0,
    spendCount: 29,
    wallets: [
      { chain: 'Solana', address: '9X4y...pL1q' },
      { chain: 'Monad Testnet', address: '0x9876543210fedcba9876543210fedcba98765432' }
    ],
    virtualAccounts: [
      { bankName: 'Wema Bank (Kudi VA)', accountNumber: '8129876543', accountName: 'Kudi/Amina Bello' }
    ],
    createdAt: '2026-08-20',
    lastActive: '25 mins ago'
  },
  {
    id: 'usr_03',
    fullName: 'Femi Adeleke',
    email: 'femi.adeleke@monadbuild.xyz',
    phoneNumber: '+2349051122334',
    kycTier: 'TIER_1',
    kycStatus: 'PENDING',
    balanceUSDC: 85.0,
    totalSpendNGN: 240000.0,
    spendCount: 3,
    wallets: [
      { chain: 'Monad Testnet', address: '0xabcdef0123456789abcdef0123456789abcdef01' }
    ],
    virtualAccounts: [],
    createdAt: '2026-09-01',
    lastActive: '1 hour ago'
  },
  {
    id: 'usr_04',
    fullName: 'Zainab Ibrahim',
    email: 'zainab.ib@horizon.africa',
    phoneNumber: '+2347012345678',
    kycTier: 'TIER_2',
    kycStatus: 'VERIFIED',
    balanceUSDC: 4800.0,
    totalSpendNGN: 12800000.0,
    spendCount: 42,
    wallets: [
      { chain: 'Solana', address: '4A1b...vN9k' },
      { chain: 'Monad Testnet', address: '0x554433221100ffeeddccbbaa9988776655443322' }
    ],
    virtualAccounts: [
      { bankName: 'Wema Bank (Kudi VA)', accountNumber: '7012345678', accountName: 'Kudi/Zainab Ibrahim' }
    ],
    createdAt: '2026-07-28',
    lastActive: '3 hours ago'
  },
  {
    id: 'usr_05',
    fullName: 'Tunde Bakare',
    email: 'tunde.b@sandbox.ng',
    phoneNumber: '+2348098765432',
    kycTier: 'UNVERIFIED',
    kycStatus: 'NOT_STARTED',
    balanceUSDC: 0.0,
    totalSpendNGN: 0.0,
    spendCount: 0,
    wallets: [
      { chain: 'Monad Testnet', address: '0x33221100ffeeddccbbaa99887766554433221100' }
    ],
    virtualAccounts: [],
    createdAt: '2026-09-10',
    lastActive: 'Yesterday'
  }
];

const fallbackKycQueue: AdminKycQueueItem[] = [
  {
    id: 'kyc_01',
    userId: 'usr_03',
    userName: 'Femi Adeleke',
    userEmail: 'femi.adeleke@monadbuild.xyz',
    bvn: '22334455667',
    nin: '11223344556',
    requestedTier: 'TIER_1',
    status: 'PENDING',
    livenessConfidenceScore: 98.6,
    documentType: 'NIN Slip & Smile Selfie Liveness',
    submittedAt: '2026-09-12 01:20:00'
  },
  {
    id: 'kyc_02',
    userId: 'usr_06',
    userName: 'Emeka Nwosu',
    userEmail: 'emeka.nwosu@gmail.com',
    bvn: '22119988776',
    nin: '33445566778',
    requestedTier: 'TIER_2',
    status: 'PENDING',
    livenessConfidenceScore: 94.2,
    documentType: 'International Passport & Utility Bill',
    submittedAt: '2026-09-11 20:45:10'
  }
];

const fallbackPayoutRails: AdminPayoutRail[] = [
  {
    id: 'PAYSTACK',
    name: 'Paystack Transfers API',
    active: true,
    balanceNGN: 84500000,
    latencyMs: 310,
    successRate: 99.8,
    supportedRails: ['NIP Instant Transfer', 'Direct Debit', 'Virtual Accounts']
  },
  {
    id: 'MONNIFY',
    name: 'Monnify Direct Payout',
    active: false,
    balanceNGN: 42300000,
    latencyMs: 420,
    successRate: 99.4,
    supportedRails: ['NIP Transfer', 'Sub-accounts', 'Dynamic VA']
  },
  {
    id: 'SQUAD',
    name: 'Squad GTCO Payout',
    active: false,
    balanceNGN: 25100000,
    latencyMs: 510,
    successRate: 98.9,
    supportedRails: ['GTCO Priority Rail', 'NIP Interbank']
  }
];

const fallbackRateState: AdminRateState = {
  currentRateNGN: 1585.5,
  blendedMarketRate: 1582.3,
  binanceP2PRate: 1583.5,
  bybitP2PRate: 1581.1,
  spreadMarginPct: 0.9,
  isOverridden: false,
  lastPolledAt: 'Just now (15s ago)'
};

const fallbackChains: AdminChainItem[] = [
  {
    id: 'monad-testnet',
    name: 'Monad Metropolis Testnet',
    type: 'EVM',
    token: 'AUSD',
    enabled: true,
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    contractAddress: '0x000000000000000000000000000000000000AUSD',
    confirmationThreshold: 12
  },
  {
    id: 'solana-mainnet',
    name: 'Solana (Dedicated SPL)',
    type: 'SOLANA',
    token: 'USDC',
    enabled: true,
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    confirmationThreshold: 32
  },
  {
    id: 'polygon-pos',
    name: 'Polygon PoS',
    type: 'EVM',
    token: 'USDC',
    enabled: false,
    rpcUrl: 'https://polygon-rpc.com',
    contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    confirmationThreshold: 64
  }
];

const fallbackNotifications: AdminNotification[] = [
  {
    id: 'nt_01',
    title: 'Monad Metropolis AUSD Deposit Live',
    body: 'Deposit Agora AUSD on Monad Testnet and enjoy sub-second off-ramping into your Naira account.',
    channel: 'PUSH',
    audience: 'ALL',
    sentAt: '2026-09-11 14:00',
    deliveredCount: 1420
  },
  {
    id: 'nt_02',
    title: 'Instant Tier 2 KYC Enabled',
    body: 'Upgrade your KYC via Smile Identity BVN verification to unlock ₦10,000,000 daily spend limits.',
    channel: 'IN_APP',
    audience: 'ALL',
    sentAt: '2026-09-10 09:30',
    deliveredCount: 1390
  }
];

const fallbackSettings: AdminSettings = {
  maintenanceMode: false,
  autoFailoverEnabled: true,
  maxDailySpendLimitNGN: 10000000,
  rateSpreadToleranceBps: 150,
  health: {
    fastifyApi: 'HEALTHY',
    postgresPrisma: 'HEALTHY',
    redisBullmq: 'HEALTHY',
    monadMetropolisRpc: 'HEALTHY',
    solanaRpc: 'HEALTHY'
  },
  auditLogs: [
    {
      id: 'aud_01',
      adminEmail: 'admin@kudi.app',
      action: 'RATE_OVERRIDE',
      details: 'Set manual rate override to ₦1,585.50 (Spread buffer: 0.9%)',
      timestamp: '2026-09-12 01:00:23'
    },
    {
      id: 'aud_02',
      adminEmail: 'admin@kudi.app',
      action: 'FAILOVER_SWITCH',
      details: 'Confirmed Paystack as primary rail. Monnify on hot standby.',
      timestamp: '2026-09-11 18:30:12'
    },
    {
      id: 'aud_03',
      adminEmail: 'compliance@kudi.app',
      action: 'KYC_TIER_UPGRADE',
      details: 'Approved TIER_2 KYC verification for usr_01 (Chinedu Okafor)',
      timestamp: '2026-09-11 15:12:44'
    }
  ]
};

// ─── LOADER FUNCTIONS ──────────────────────────────────────────────────

export async function loadDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const snapshotFallback: AdminDashboardSnapshot = {
    kpis: fallbackKpis,
    volumeChart: fallbackVolumeChart,
    recentTransactions: fallbackTransactions,
    recentDeposits: fallbackDeposits,
    rateState: fallbackRateState,
    payoutRails: fallbackPayoutRails,
    custodyTrack: 'Track A: Self-Custody (Privy Embedded Server Wallets)',
    usersSummary: {
      total: fallbackUsers.length,
      tier1: fallbackUsers.filter((u) => u.kycTier === 'TIER_1').length,
      tier2: fallbackUsers.filter((u) => u.kycTier === 'TIER_2').length,
      verifiedKycPct: 80
    }
  };

  return adminFetch<AdminDashboardSnapshot>('/dashboard', snapshotFallback);
}

export async function loadUsers(): Promise<AdminUser[]> {
  return adminFetch<AdminUser[]>('/users', fallbackUsers);
}

export async function getUserDetail(id: string): Promise<AdminUser | null> {
  const users = await loadUsers();
  const user = users.find((u) => u.id === id);
  return user ?? users[0] ?? null;
}

export async function loadTransactions(): Promise<AdminSpendTransaction[]> {
  return adminFetch<AdminSpendTransaction[]>('/transactions', fallbackTransactions);
}

export async function getTransactionDetail(id: string): Promise<AdminSpendTransaction | null> {
  const txs = await loadTransactions();
  return txs.find((t) => t.id === id || t.reference === id) ?? txs[0] ?? null;
}

export async function loadDeposits(): Promise<AdminDeposit[]> {
  return adminFetch<AdminDeposit[]>('/deposits', fallbackDeposits);
}

export async function loadKycQueue(): Promise<AdminKycQueueItem[]> {
  return adminFetch<AdminKycQueueItem[]>('/kyc', fallbackKycQueue);
}

export async function loadPayoutRails(): Promise<AdminPayoutRail[]> {
  return adminFetch<AdminPayoutRail[]>('/rails', fallbackPayoutRails);
}

export async function loadRateEngineState(): Promise<AdminRateState> {
  return adminFetch<AdminRateState>('/rates', fallbackRateState);
}

export async function loadChainConfigs(): Promise<AdminChainItem[]> {
  return adminFetch<AdminChainItem[]>('/chains', fallbackChains);
}

export async function loadNotifications(): Promise<AdminNotification[]> {
  return adminFetch<AdminNotification[]>('/notifications', fallbackNotifications);
}

export async function loadSystemSettings(): Promise<AdminSettings> {
  return adminFetch<AdminSettings>('/settings', fallbackSettings);
}
