import { findAssociatedTokenPda } from '@solana-program/associated-token';
import { address } from '@solana/kit';

async function main() {
  const treasuryAddr = address('8ztRwPpRnETrNKXRefzQo9fKFmcGSws3H1qxRhaLyFz2');
  const mintPubkey = address('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  const TOKEN_PROGRAM_ADDRESS = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

  const [pda] = await findAssociatedTokenPda({
    owner: treasuryAddr,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: mintPubkey
  });

  console.log('findAssociatedTokenPda result:', pda);
  console.log('Target ATA on RPC:', 'RgA4eAXJLQyqpX1bXgiS6znrJbVK3JwKFSJihyPnC9L');
  console.log('Matches?', pda === 'RgA4eAXJLQyqpX1bXgiS6znrJbVK3JwKFSJihyPnC9L');
}

main().catch(console.error);
