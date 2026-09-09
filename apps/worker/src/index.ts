import { ChainDepositProcessor } from './processors/chainDepositProcessor';
import { pollRateEngine } from './processors/ratePollerProcessor';
import { WebhookProcessor } from './processors/webhookProcessor';
import { processCryptoWithdrawals } from './processors/cryptoWithdrawalProcessor';
import { EVMChainConfig, ChainType } from '@kudi/types';
import dotenv from 'dotenv';

dotenv.config();

const monadTestnetConfig: EVMChainConfig = {
  id: 'monad-testnet',
  name: 'Monad Metropolis Testnet',
  chainId: 10143,
  type: ChainType.EVM,
  rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  tokenContractAddress: process.env.AUSD_TOKEN_ADDRESS || '0x000000000000000000000000000000000000AUSD',
  tokenSymbol: 'AUSD',
  tokenDecimals: 6,
  confirmationThreshold: 1,
  enabled: true
};

const depositProcessor = new ChainDepositProcessor(monadTestnetConfig);
const webhookProcessor = new WebhookProcessor();

console.log('⚡ Kudi Background Worker started');
console.log(`🔗 Listening on Solana USDC Mint: ${depositProcessor.getSolanaConfig().usdcMintAddress}`);
console.log(`🔗 Listening on EVM Chain: ${monadTestnetConfig.name} (${monadTestnetConfig.tokenSymbol})`);
console.log('📥 Webhook Processor active for Squad, Monnify, Paystack, Korapay, Privy');
console.log('📤 Crypto Withdrawal Processor active (polling every 5s)');

setInterval(pollRateEngine, 10000);
setInterval(() => depositProcessor.pollAllChains(), 15000);
setInterval(() => processCryptoWithdrawals(), 5000);

pollRateEngine();
