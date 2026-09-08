import { EVMChainConfig } from '@kudi/types';

export interface EVMDepositEvent {
  txHash: string;
  chainSlug: string;
  userWalletAddress: string;
  amountToken: string;
  tokenContract: string;
  blockNumber: number;
  confirmed: boolean;
}

export class GeneralizedEVMListener {
  private chainConfigs: Map<string, EVMChainConfig> = new Map();

  constructor(configs: EVMChainConfig[] = []) {
    configs.forEach((c) => this.registerChain(c));
  }

  public registerChain(config: EVMChainConfig): void {
    if (config.enabled) {
      this.chainConfigs.set(config.id, config);
    }
  }

  public removeChain(chainId: string): void {
    this.chainConfigs.delete(chainId);
  }

  public getEnabledChains(): EVMChainConfig[] {
    return Array.from(this.chainConfigs.values());
  }

  public async pollChainForDeposits(chainId: string, watchedAddresses: string[]): Promise<EVMDepositEvent[]> {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Chain ${chainId} is not enabled or registered.`);
    }

    const events: EVMDepositEvent[] = [];
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    for (const address of watchedAddresses) {
      if (!address.startsWith('0x') || address.includes('user_')) {
        // Skip non-hex or mock testnet format addresses
        continue;
      }

      try {
        const cleanAddress = address.slice(2).padStart(40, '0');
        const paddedToAddress = `0x000000000000000000000000${cleanAddress}`;

        // Get latest block number for confirmation depth check
        const blockRes = await fetch(config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          })
        });
        const blockData = await blockRes.json();
        const latestBlock = blockData.result ? parseInt(blockData.result, 16) : 0;

        // Query Transfer logs to the watched address
        const logsRes = await fetch(config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [
              {
                address: config.tokenContractAddress || undefined,
                topics: [transferTopic, null, paddedToAddress],
                fromBlock: 'latest'
              }
            ],
            id: 2
          })
        });

        const logsData = await logsRes.json();
        const logs = logsData.result || [];

        for (const log of logs) {
          const logBlock = log.blockNumber ? parseInt(log.blockNumber, 16) : 0;
          const confirmations = latestBlock > 0 && logBlock > 0 ? latestBlock - logBlock : 0;
          const confirmed = confirmations >= config.confirmationThreshold;

          const rawAmount = BigInt(log.data || '0x0');
          const amountToken = (Number(rawAmount) / Math.pow(10, config.tokenDecimals || 18)).toFixed(2);

          events.push({
            txHash: log.transactionHash,
            chainSlug: config.id,
            userWalletAddress: address,
            amountToken,
            tokenContract: log.address || config.tokenContractAddress,
            blockNumber: logBlock,
            confirmed
          });
        }
      } catch (err) {
        console.warn(`EVM polling failed on chain ${chainId} for address ${address}:`, err);
      }
    }

    return events;
  }
}

export { GeneralizedEVMListener as EVMListener };
