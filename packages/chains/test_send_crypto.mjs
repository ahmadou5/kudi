import fs from 'fs';
const envContent = fs.readFileSync('/home/ahmadou/metropolis/.env', 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import {
  address as solanaAddress,
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  compileTransaction,
  getProgramDerivedAddress,
  getAddressEncoder
} from '@solana/kit';
import { getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const rpc = createSolanaRpc(rpcUrl);

  const treasuryWalletId = process.env.KUDI_SOLANA_TREASURY_WALLET_ID || process.env.PRIVY_SOLANA_TREASURY_WALLET_ID || process.env.SOLANA_TREASURY_WALLET_ID || process.env.PRIVY_TREASURY_WALLET_ID;
  const treasuryAddrStr = process.env.KUDI_TREASURY_SOLANA_ADDRESS || process.env.PRIVY_TREASURY_SOLANA_ADDRESS || '8ztRwPpRnETrNKXRefzQo9fKFmcGSws3H1qxRhaLyFz2';
  const toAddressStr = 'BwY8CufbYyRerwZ3N2F6e77Gv1G9dK1L3xY7vP1v1111';
  const mintAddrStr = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

  const treasuryAddr = solanaAddress(treasuryAddrStr);
  const recipientAddr = solanaAddress(toAddressStr);
  const mintPubkey = solanaAddress(mintAddrStr);

  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'finalized' }).send();

  // Find source token account owned by treasury
  const tokenAccountsRes = await rpc.getTokenAccountsByOwner(treasuryAddr, { mint: mintPubkey }, { encoding: 'jsonParsed' }).send();
  let sourceAtaStr = tokenAccountsRes.value?.[0]?.pubkey;

  const ATA_PROGRAM_ADDRESS = solanaAddress('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS');
  const SYSTEM_PROGRAM_ADDRESS = solanaAddress('11111111111111111111111111111111');
  const addrEncoder = getAddressEncoder();

  if (!sourceAtaStr) {
    const [derivedSource] = await getProgramDerivedAddress({
      programAddress: ATA_PROGRAM_ADDRESS,
      seeds: [addrEncoder.encode(treasuryAddr), addrEncoder.encode(TOKEN_PROGRAM_ADDRESS), addrEncoder.encode(mintPubkey)]
    });
    sourceAtaStr = derivedSource;
  }

  const sourceAta = solanaAddress(sourceAtaStr);

  const [destAta] = await getProgramDerivedAddress({
    programAddress: ATA_PROGRAM_ADDRESS,
    seeds: [addrEncoder.encode(recipientAddr), addrEncoder.encode(TOKEN_PROGRAM_ADDRESS), addrEncoder.encode(mintPubkey)]
  });

  console.log('Source Token Account:', sourceAtaStr);
  console.log('Destination ATA:', destAta);

  const createDestAtaIx = {
    programAddress: ATA_PROGRAM_ADDRESS,
    accounts: [
      { address: treasuryAddr, role: 3 },
      { address: destAta, role: 1 },
      { address: recipientAddr, role: 0 },
      { address: mintPubkey, role: 0 },
      { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
      { address: TOKEN_PROGRAM_ADDRESS, role: 0 }
    ],
    data: new Uint8Array([1])
  };

  const amountUSDC = 0.1;
  const amountRaw = BigInt(Math.floor(amountUSDC * 1_000_000));
  const transferIx = getTransferCheckedInstruction({
    source: sourceAta,
    mint: mintPubkey,
    destination: destAta,
    authority: treasuryAddr,
    amount: amountRaw,
    decimals: 6
  });

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(treasuryAddr, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstruction(createDestAtaIx, tx),
    (tx) => appendTransactionMessageInstruction(transferIx, tx)
  );

  const compiled = compileTransaction(txMessage);
  const msgBytes = compiled.messageBytes;
  const numSigs = msgBytes[0] || 1;
  const wireBytes = new Uint8Array(1 + numSigs * 64 + msgBytes.length);
  wireBytes[0] = numSigs;
  wireBytes.set(msgBytes, 1 + numSigs * 64);
  const serializedTx = Buffer.from(wireBytes).toString('base64');

  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const authHeader = `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`;

  const res = await fetch(`https://api.privy.io/v1/wallets/${treasuryWalletId}/rpc`, {
    method: 'POST',
    headers: {
      'privy-app-id': appId,
      Authorization: authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      method: 'signAndSendTransaction',
      caip2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      params: {
        transaction: serializedTx,
        encoding: 'base64'
      }
    })
  });

  const resJson = await res.json();
  console.log('Privy RPC Response:', JSON.stringify(resJson, null, 2));
}

main().catch(console.error);
