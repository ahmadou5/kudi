import { TransactionItem } from '../hooks/useTransactions';
import { TransactionData } from '../components/TransactionCard';
import { formatIntelligentTimestamp } from './timeUtils';

export type TransactionDirection = 'deposit' | 'send' | 'payout';

interface MappedTransaction extends TransactionData {
  direction: TransactionDirection;
  amountValue: number;
  timestampMs: number;
}

/**
 * Maps raw API transaction items (ledger shape) into display-ready
 * TransactionCard data, classified by direction for filtering/sorting.
 * Shared by the tab Activities screen and the settings history screen.
 */
export function mapApiTransactions(
  apiTxs: TransactionItem[] | null | undefined,
  userId: string | undefined,
  rateNGN: number
): MappedTransaction[] {
  return (apiTxs || []).map((tx: any, idx: number): MappedTransaction => {
    const metaType = String(tx.metadata?.type || '');
    const ref = String(tx.reference || '');

    const isDeposit =
      tx.toUserId === userId ||
      tx.fromUserId === 'CHAIN_DEPOSIT' ||
      metaType === 'DEPOSIT' ||
      metaType === 'DEPOSIT_CREDIT' ||
      metaType === 'DEPOSIT_ONCHAIN';

    const isCryptoSend =
      !isDeposit &&
      (metaType === 'CRYPTO_SEND_DEBIT' ||
        metaType === 'SPEND_ONCHAIN' ||
        ref.startsWith('KUDI_ONCHAIN'));

    const direction: TransactionDirection = isDeposit
      ? 'deposit'
      : isCryptoSend
        ? 'send'
        : 'payout';

    const rawChain = (tx.metadata?.chain || tx.chain || '').toLowerCase();
    const isMonad =
      rawChain.includes('monad') ||
      tx.currency === 'AUSD' ||
      tx.metadata?.tokenSymbol === 'AUSD' ||
      String(tx.metadata?.title || '').includes('AUSD');
    const isSolana =
      rawChain.includes('solana') || tx.currency === 'USDC' || (!isMonad && isDeposit);

    const tokenSymbol = isMonad ? 'AUSD' : tx.currency || 'USDC';
    const chainName = isMonad ? 'monad' : isSolana ? 'solana' : '';

    const rawAmount =
      typeof tx.amount === 'number' ? tx.amount.toFixed(2) : String(tx.amount || '0.00');
    const amountNum = parseFloat(rawAmount) || 0;
    const amountNGN = amountNum * rateNGN;

    const timestampMs = tx.timestamp ? new Date(tx.timestamp).getTime() || 0 : 0;

    const defaultTitle = isDeposit
      ? `${tokenSymbol} Deposit`
      : isCryptoSend
        ? `Send to ${(tx.metadata?.chain || 'solana').toUpperCase()}`
        : 'Bank Payout';

    return {
      id: ref || `tx_${idx}`,
      ref,
      txHash: tx.metadata?.txHash || ref,
      title: tx.metadata?.title || defaultTitle,
      subtitle:
        tx.metadata?.subtitle ||
        (isDeposit
          ? `${isMonad ? 'Monad Testnet' : 'Solana Network'}`
          : isCryptoSend && tx.metadata?.toAddress
            ? `${String(tx.metadata.toAddress).slice(0, 6)}...${String(tx.metadata.toAddress).slice(-4)}`
            : `${tx.currency || 'NGN'} Transfer`),
      amount: `${isDeposit ? '+' : '-'}$${amountNum.toFixed(2)} ${tokenSymbol}`,
      secondaryAmount: `≈ ₦${amountNGN.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} NGN`,
      status:
        tx.metadata?.status && ['SUCCESS', 'COMPLETED'].includes(String(tx.metadata.status).toUpperCase())
          ? 'CONFIRMED'
          : tx.metadata?.status || (isDeposit ? 'CONFIRMED' : 'PENDING'),
      date: formatIntelligentTimestamp(tx.timestamp),
      isDeposit,
      chain: chainName,
      tokenSymbol,
      metadata: tx.metadata,
      direction,
      amountValue: amountNum,
      timestampMs
    };
  });
}
