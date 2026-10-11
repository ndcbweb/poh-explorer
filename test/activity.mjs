// Puts real activity on a fresh cluster for the e2e test: a native transfer and an SPL token
// (mint, associated accounts, mint-to and a token transfer). Prints the ids the test asserts on as JSON.
import { readFileSync } from "node:fs";
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer } from "@solana/spl-token";

const [rpcUrl, keyFile] = process.argv.slice(2);
const connection = new Connection(rpcUrl, "confirmed");
const treasury = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyFile, "utf8"))));
const recipient = Keypair.generate();

const transferSig = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(SystemProgram.transfer({ fromPubkey: treasury.publicKey, toPubkey: recipient.publicKey, lamports: 3 * LAMPORTS_PER_SOL })),
  [treasury]
);

const mint = await createMint(connection, treasury, treasury.publicKey, null, 6);
const source = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, treasury.publicKey);
const destination = await getOrCreateAssociatedTokenAccount(connection, treasury, mint, recipient.publicKey);
await mintTo(connection, treasury, mint, source.address, treasury, 1_000_000_000n);
const tokenSig = await transfer(connection, treasury, source.address, destination.address, treasury, 250_000_000n);

console.log(
  JSON.stringify({
    treasury: treasury.publicKey.toBase58(),
    recipient: recipient.publicKey.toBase58(),
    transferSig,
    mint: mint.toBase58(),
    tokenSig,
    recipientTokenAccount: destination.address.toBase58(),
  })
);
