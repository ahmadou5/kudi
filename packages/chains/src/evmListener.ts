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
  private lastScannedBlockMap: Map<string, number> = new Map();

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

    // Filter valid watched EVM addresses and map to 32-byte padded topic hex
    const paddedTopicToAddress = new Map<string, string>();
    for (const addr of watchedAddresses) {
      if (!addr || !addr.startsWith('0x') || addr.includes('user_')) {
        continue;
      }
      const cleanAddr = addr.toLowerCase().slice(2).padStart(40, '0');
      const paddedTopic = `0x000000000000000000000000${cleanAddr}`;
      paddedTopicToAddress.set(paddedTopic.toLowerCase(), addr);
    }

    const paddedTopics = Array.from(paddedTopicToAddress.keys());
    if (paddedTopics.length === 0) {
      return events;
    }

    try {
      // 1. Fetch latest block number
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
      if (!latestBlock || latestBlock <= 0) return events;

      // Monad RPC limits eth_getLogs to max 100 blocks per request and 25 requests/second
      const maxRange = 100;
      const lastScanned = this.lastScannedBlockMap.get(chainId);

      // On first scan, lookback 500 blocks (~2 mins on Monad); on subsequent polls, scan from lastScanned - 10
      const defaultLookback = 500;
      const fromBlock = lastScanned ? Math.max(0, lastScanned - 10) : Math.max(0, latestBlock - defaultLookback);
      const toBlock = latestBlock;

      const tokenContract = config.tokenContractAddress ? config.tokenContractAddress.toLowerCase() : undefined;
      // Topic 2 can be a single topic or array of topics (OR filter)
      const topic2Param = paddedTopics.length === 1 ? paddedTopics[0] : paddedTopics;

      // Query RPC in 100-block chunks with rate-limiting delay and backoff
      for (let chunkStart = fromBlock; chunkStart <= toBlock; chunkStart += maxRange) {
        const chunkEnd = Math.min(chunkStart + maxRange - 1, toBlock);
        const fromHex = '0x' + chunkStart.toString(16);
        const toHex = '0x' + chunkEnd.toString(16);

        // Throttle chunk queries to stay safely under Monad's 25 req/sec ceiling (~12 req/sec)
        await new Promise((resolve) => setTimeout(resolve, 80));

        let logsData: any = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            const logsRes = await fetch(config.rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getLogs',
                params: [
                  {
                    address: tokenContract,
                    topics: [transferTopic, null, topic2Param],
                    fromBlock: fromHex,
                    toBlock: toHex
                  }
                ],
                id: 2
              })
            });

            logsData = await logsRes.json();

            // Check if rate limited (-32011)
            if (logsData?.error?.code === -32011 || logsData?.error?.message?.includes('requests limited')) {
              const backoffMs = attempts * 750;
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }

            break;
          } catch (fetchErr) {
            if (attempts >= maxAttempts) throw fetchErr;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        if (logsData?.error) {
          console.warn(`[EVMListener] eth_getLogs RPC error (${fromHex}..${toHex}):`, logsData.error);
          continue;
        }

        const logs = logsData.result || [];
        for (const log of logs) {
          const logBlock = log.blockNumber ? parseInt(log.blockNumber, 16) : 0;
          const confirmations = latestBlock > 0 && logBlock > 0 ? latestBlock - logBlock : 0;
          const confirmed = confirmations >= (config.confirmationThreshold ?? 1);

          const rawAmount = BigInt(log.data || '0x0');
          const decimals = config.tokenDecimals || 6;
          const divisor = Math.pow(10, decimals);
          const amountTokenRaw = (Number(rawAmount) / divisor).toFixed(decimals);
          const amountToken = String(Number(amountTokenRaw));

          // Determine recipient address from log topic 2
          const recipientTopic = log.topics?.[2]?.toLowerCase();
          const recipientAddress = recipientTopic ? (paddedTopicToAddress.get(recipientTopic) || `0x${recipientTopic.slice(26)}`) : watchedAddresses[0];

          events.push({
            txHash: log.transactionHash,
            chainSlug: config.id,
            userWalletAddress: recipientAddress,
            amountToken,
            tokenContract: log.address || config.tokenContractAddress,
            blockNumber: logBlock,
            confirmed
          });
        }
      }

      this.lastScannedBlockMap.set(chainId, latestBlock);
    } catch (err) {
      console.warn(`EVM polling failed on chain ${chainId}:`, err);
    }

    return events;
  }
}

export { GeneralizedEVMListener as EVMListener };

