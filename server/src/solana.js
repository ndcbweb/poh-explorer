import { rpc } from "./rpc.js";

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const VOTE_PROGRAM = "Vote111111111111111111111111111111111111111";
export const STAKE_PROGRAM = "Stake11111111111111111111111111111111111111";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const SYSVAR_OWNER = "Sysvar1111111111111111111111111111111111111";

export const PROGRAM_NAMES = {
  [SYSTEM_PROGRAM]: "System Program",
  [VOTE_PROGRAM]: "Vote Program",
  [STAKE_PROGRAM]: "Stake Program",
  [TOKEN_PROGRAM]: "Token Program",
  [TOKEN_2022_PROGRAM]: "Token-2022 Program",
  ComputeBudget111111111111111111111111111111: "Compute Budget Program",
  AddressLookupTab1e1111111111111111111111111: "Address Lookup Table Program",
  Config1111111111111111111111111111111111111: "Config Program",
  Feature111111111111111111111111111111111111: "Feature Gate Program",
  BPFLoaderUpgradeab1e11111111111111111111111: "BPF Upgradeable Loader",
  BPFLoader2111111111111111111111111111111111: "BPF Loader 2",
  BPFLoader1111111111111111111111111111111111: "BPF Loader",
  LoaderV411111111111111111111111111111111111: "Loader v4",
  NativeLoader1111111111111111111111111111111: "Native Loader",
  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: "Associated Token Account Program",
  MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr: "Memo Program",
  Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo: "Memo Program v1",
  Feat1YXHhH6t1juaWF74WLcfv4XoNocjXA6sPWHNgAse: "Feature Proposal Program",
  Ed25519SigVerify111111111111111111111111111: "Ed25519 Signature Program",
  KeccakSecp256k11111111111111111111111111111: "Secp256k1 Signature Program",
  Secp256r1SigVerify1111111111111111111111111: "Secp256r1 Signature Program",
  [SYSVAR_OWNER]: "Sysvar",
  SysvarC1ock11111111111111111111111111111111: "Clock Sysvar",
  SysvarRent111111111111111111111111111111111: "Rent Sysvar",
  SysvarEpochSchedu1e111111111111111111111111: "Epoch Schedule Sysvar",
  SysvarRecentB1ockHashes11111111111111111111: "Recent Blockhashes Sysvar",
  SysvarS1otHashes111111111111111111111111111: "Slot Hashes Sysvar",
  SysvarStakeHistory1111111111111111111111111: "Stake History Sysvar",
  SysvarFees111111111111111111111111111111111: "Fees Sysvar",
  Sysvar1nstructions1111111111111111111111111: "Instructions Sysvar",
  SysvarEpochRewards1111111111111111111111111: "Epoch Rewards Sysvar",
  SysvarLastRestartS1ot1111111111111111111111: "Last Restart Slot Sysvar",
};

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((char, i) => [char, i]));

/** Decoded byte length of a base58 string, or -1 when it is not base58. */
export function base58Length(value) {
  if (!value || value.length > 100) return -1;
  let bytes = [];
  for (const char of value) {
    let carry = INDEX.get(char);
    if (carry === undefined) return -1;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (value[zeros] === "1") zeros += 1;
  return zeros + bytes.length;
}

export const isAddress = (value) => base58Length(value) === 32;
export const isSignature = (value) => base58Length(value) === 64;

const big = (value) => BigInt(value ?? 0);

let txVersion = 1;

/** Calls with the newest transaction version the node accepts; nodes without v1 support reject the param. */
async function versioned(method, target, options) {
  try {
    return await rpc(method, [target, { ...options, maxSupportedTransactionVersion: txVersion }]);
  } catch (error) {
    if (txVersion === 0 || error.code !== -32602 || !/version/i.test(error.message)) throw error;
    txVersion = 0;
    return rpc(method, [target, { ...options, maxSupportedTransactionVersion: 0 }]);
  }
}

const getBlock = (slot, details) =>
  versioned("getBlock", slot, { encoding: "json", transactionDetails: details, rewards: true, commitment: "confirmed" });

function keyOf(entry) {
  return typeof entry === "string" ? entry : entry?.pubkey;
}

/** One row per transaction from a getBlock(transactionDetails: "accounts") entry. */
export function txRow(entry, slot, blockTime) {
  const keys = entry.transaction.accountKeys || [];
  const pubkeys = keys.map(keyOf);
  const programs = [...new Set(pubkeys.filter((key) => PROGRAM_NAMES[key] && !key.startsWith("Sysvar")))];
  const signer = keys.find((key) => key.signer);
  const pre = entry.meta?.preBalances || [];
  const post = entry.meta?.postBalances || [];
  let moved = 0n;
  for (let i = 0; i < pre.length; i += 1) {
    const delta = big(post[i]) - big(pre[i]);
    if (delta > moved) moved = delta;
  }
  return {
    signature: entry.transaction.signatures[0],
    slot,
    blockTime: blockTime ?? null,
    vote: pubkeys.includes(VOTE_PROGRAM),
    ok: !entry.meta?.err,
    fee: String(entry.meta?.fee ?? 0),
    signer: keyOf(signer) || pubkeys[0] || null,
    programs: programs.map((id) => ({ id, name: PROGRAM_NAMES[id] })),
    accounts: keys.length,
    computeUnits: entry.meta?.computeUnitsConsumed ?? null,
    value: moved.toString(),
  };
}

const summaries = new Map();
const SUMMARY_CACHE = 600;

/** Compact, cached view of a confirmed block: header, counts, leader and its non-vote transactions. */
export async function blockSummary(slot) {
  if (summaries.has(slot)) return summaries.get(slot);
  const block = await getBlock(slot, "accounts");
  if (!block) return null;
  const txs = (block.transactions || []).map((entry) => txRow(entry, slot, block.blockTime));
  const feeReward = (block.rewards || []).find((reward) => reward.rewardType === "Fee");
  let leader = feeReward?.pubkey || null;
  if (!leader) leader = (await rpc("getSlotLeaders", [slot, 1]).catch(() => []))[0] || null;
  const summary = {
    slot,
    blockhash: block.blockhash,
    parentSlot: block.parentSlot,
    previousBlockhash: block.previousBlockhash,
    blockTime: block.blockTime ?? null,
    blockHeight: block.blockHeight ?? null,
    leader,
    leaderReward: feeReward ? String(feeReward.lamports) : "0",
    txCount: txs.length,
    voteCount: txs.filter((tx) => tx.vote).length,
    failed: txs.filter((tx) => !tx.ok).length,
    fees: txs.reduce((sum, tx) => sum + big(tx.fee), 0n).toString(),
    computeUnits: txs.some((tx) => tx.computeUnits != null) ? txs.reduce((sum, tx) => sum + (tx.computeUnits || 0), 0) : null,
    userTxs: txs.filter((tx) => !tx.vote).slice(0, 50),
  };
  summaries.set(slot, summary);
  if (summaries.size > SUMMARY_CACHE) summaries.delete(summaries.keys().next().value);
  return summary;
}

/** Full block with every transaction row (votes included) for the block page. */
export async function blockDetail(slot) {
  const block = await getBlock(slot, "accounts");
  if (!block) return null;
  const summary = await blockSummary(slot);
  return {
    ...summary,
    userTxs: undefined,
    rewards: (block.rewards || []).map((reward) => ({
      pubkey: reward.pubkey,
      lamports: String(reward.lamports),
      postBalance: String(reward.postBalance),
      type: reward.rewardType,
      commission: reward.commission ?? null,
    })),
    txs: (block.transactions || []).map((entry) => txRow(entry, slot, block.blockTime)),
  };
}

/** Confirmed slots ending at `end` (inclusive), newest first. Skipped slots are left out. */
export async function recentSlots(end, count) {
  const start = Math.max(0, end - Math.max(count * 3, 32));
  const slots = await rpc("getBlocks", [start, end, { commitment: "confirmed" }]);
  return slots.slice(-count).reverse();
}

function tokenAmount(info) {
  const amount = info?.tokenAmount || {};
  return { amount: amount.amount ?? "0", decimals: amount.decimals ?? 0, ui: amount.uiAmountString ?? "0" };
}

/** Token accounts held by `owner` across both token programs. */
export async function tokenHoldings(owner) {
  const lists = await Promise.all(
    [TOKEN_PROGRAM, TOKEN_2022_PROGRAM].map((programId) =>
      rpc("getTokenAccountsByOwner", [owner, { programId }, { encoding: "jsonParsed", commitment: "confirmed" }])
        .then((result) => result.value.map((row) => ({ ...row, programId })))
        .catch(() => [])
    )
  );
  return lists
    .flat()
    .map((row) => {
      const info = row.account.data?.parsed?.info || {};
      return { account: row.pubkey, mint: info.mint, program: row.programId, state: info.state, ...tokenAmount(info) };
    })
    .sort((a, b) => (big(b.amount) > big(a.amount) ? 1 : -1));
}

/** Classifies an account from getAccountInfo(jsonParsed) and loads the extra data its page needs. */
export async function describeAccount(address, account) {
  if (!account) return { kind: "unfunded", label: "Unfunded account" };
  const parsed = account.data?.parsed;
  const base = {
    lamports: String(account.lamports),
    owner: account.owner,
    ownerName: PROGRAM_NAMES[account.owner] || null,
    executable: account.executable,
    space: account.space ?? parsed?.space ?? null,
    rentEpoch: account.rentEpoch != null ? String(account.rentEpoch) : null,
  };

  if (account.executable) {
    const programData = parsed?.parsed?.info?.programData;
    let upgrade = null;
    if (programData) {
      const data = await rpc("getAccountInfo", [programData, { encoding: "jsonParsed" }]).catch(() => null);
      const info = data?.value?.data?.parsed?.parsed?.info;
      upgrade = { programData, authority: info?.authority ?? null, slot: info?.slot ?? null };
    }
    return { ...base, kind: "program", label: PROGRAM_NAMES[address] || "Program", upgrade };
  }

  if (account.owner === TOKEN_PROGRAM || account.owner === TOKEN_2022_PROGRAM) {
    const type = parsed?.parsed?.type;
    const info = parsed?.parsed?.info || {};
    if (type === "mint") {
      const [largest, holders] = await Promise.all([
        rpc("getTokenLargestAccounts", [address, { commitment: "confirmed" }]).catch(() => null),
        holderCount(address, account.owner),
      ]);
      const top = (largest?.value || []).slice(0, 20);
      const owners = top.length
        ? await rpc("getMultipleAccounts", [top.map((row) => row.address), { encoding: "jsonParsed" }]).catch(() => null)
        : null;
      return {
        ...base,
        kind: "mint",
        label: account.owner === TOKEN_2022_PROGRAM ? "Token-2022 mint" : "Token mint",
        mint: {
          decimals: info.decimals,
          supply: info.supply,
          mintAuthority: info.mintAuthority ?? null,
          freezeAuthority: info.freezeAuthority ?? null,
          initialized: info.isInitialized !== false,
          extensions: (info.extensions || []).map((ext) => ext.extension),
          holders,
        },
        largest: top.map((row, i) => ({
          account: row.address,
          owner: owners?.value?.[i]?.data?.parsed?.info?.owner ?? null,
          amount: row.amount,
          ui: row.uiAmountString,
        })),
      };
    }
    if (type === "account") {
      return {
        ...base,
        kind: "tokenAccount",
        label: "Token account",
        token: { mint: info.mint, owner: info.owner, state: info.state, delegate: info.delegate ?? null, ...tokenAmount(info) },
      };
    }
  }

  if (account.owner === VOTE_PROGRAM && parsed?.parsed?.info) {
    const info = parsed.parsed.info;
    const credits = info.epochCredits || [];
    return {
      ...base,
      kind: "vote",
      label: "Vote account",
      vote: {
        node: info.nodePubkey,
        withdrawer: info.authorizedWithdrawer,
        voters: (info.authorizedVoters || []).map((row) => row.authorizedVoter),
        commission: info.commission,
        rootSlot: info.rootSlot ?? null,
        lastVote: info.votes?.at(-1)?.slot ?? null,
        lastTimestamp: info.lastTimestamp ?? null,
        epochCredits: credits.slice(-10).map((row) => ({
          epoch: row.epoch,
          credits: String(big(row.credits) - big(row.previousCredits)),
        })),
      },
    };
  }

  if (account.owner === STAKE_PROGRAM && parsed?.parsed?.info) {
    const info = parsed.parsed.info;
    const delegation = info.stake?.delegation;
    return {
      ...base,
      kind: "stake",
      label: "Stake account",
      stake: {
        state: parsed.parsed.type,
        staker: info.meta?.authorized?.staker ?? null,
        withdrawer: info.meta?.authorized?.withdrawer ?? null,
        rentExemptReserve: info.meta?.rentExemptReserve ?? null,
        voter: delegation?.voter ?? null,
        delegated: delegation?.stake ?? null,
        activationEpoch: delegation?.activationEpoch ?? null,
        deactivationEpoch: delegation?.deactivationEpoch ?? null,
      },
    };
  }

  if (account.owner === SYSVAR_OWNER) return { ...base, kind: "sysvar", label: PROGRAM_NAMES[address] || "Sysvar" };
  if (account.owner === SYSTEM_PROGRAM) {
    return { ...base, kind: parsed?.parsed?.type === "initialized" ? "nonce" : "wallet", label: parsed ? "Nonce account" : "Wallet" };
  }
  return { ...base, kind: "data", label: "Program-owned account" };
}

/** Number of token accounts for a mint (needs the RPC node's spl-token-mint index). */
async function holderCount(mint, programId) {
  const filters = [{ memcmp: { offset: 0, bytes: mint } }];
  if (programId === TOKEN_PROGRAM) filters.push({ dataSize: 165 });
  const rows = await rpc(
    "getProgramAccounts",
    [programId, { encoding: "base64", dataSlice: { offset: 0, length: 0 }, filters, commitment: "confirmed" }],
    { timeoutMs: 20_000 }
  ).catch(() => null);
  return rows ? rows.length : null;
}

/** Every mint on the chain from both token programs. */
export async function listMints() {
  const query = (programId, filters) =>
    rpc("getProgramAccounts", [programId, { encoding: "jsonParsed", filters, commitment: "confirmed" }], { timeoutMs: 20_000 })
      .then((rows) => rows.map((row) => ({ ...row, programId })))
      .catch(() => []);
  const rows = (
    await Promise.all([
      query(TOKEN_PROGRAM, [{ dataSize: 82 }]),
      query(TOKEN_2022_PROGRAM, [{ dataSize: 82 }]),
      // Token-2022 mints with extensions carry AccountType::Mint (1, base58 "2") right after the 165-byte base.
      query(TOKEN_2022_PROGRAM, [{ memcmp: { offset: 165, bytes: "2" } }]),
    ])
  ).flat();
  return rows
    .map((row) => {
      const info = row.account.data?.parsed?.info || {};
      return {
        mint: row.pubkey,
        program: row.programId === TOKEN_2022_PROGRAM ? "Token-2022" : "Token",
        decimals: info.decimals,
        supply: info.supply ?? "0",
        mintAuthority: info.mintAuthority ?? null,
        freezeAuthority: info.freezeAuthority ?? null,
      };
    })
    .sort((a, b) => (big(b.supply) > big(a.supply) ? 1 : -1));
}

/** Parsed transaction for the transaction page. */
export async function transaction(signature) {
  const [tx, status] = await Promise.all([
    versioned("getTransaction", signature, { encoding: "jsonParsed", commitment: "confirmed" }),
    rpc("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]).catch(() => null),
  ]);
  if (!tx) return null;
  const message = tx.transaction.message;
  const meta = tx.meta || {};
  const keys = message.accountKeys.map((key) => ({ pubkey: key.pubkey, signer: key.signer, writable: key.writable, source: key.source }));
  const instruction = (ix) => ({
    programId: ix.programId,
    program: ix.program || PROGRAM_NAMES[ix.programId] || null,
    programName: PROGRAM_NAMES[ix.programId] || ix.program || null,
    type: ix.parsed?.type || null,
    info: ix.parsed?.info ?? (typeof ix.parsed === "string" ? { memo: ix.parsed } : null),
    accounts: ix.accounts || null,
    data: ix.data || null,
    stackHeight: ix.stackHeight ?? null,
  });
  const inner = new Map((meta.innerInstructions || []).map((row) => [row.index, row.instructions.map(instruction)]));
  const tokenRows = new Map();
  for (const [field, rows] of [
    ["pre", meta.preTokenBalances || []],
    ["post", meta.postTokenBalances || []],
  ]) {
    for (const row of rows) {
      const entry = tokenRows.get(row.accountIndex) || {
        account: keys[row.accountIndex]?.pubkey,
        mint: row.mint,
        owner: row.owner ?? null,
        decimals: row.uiTokenAmount.decimals,
        pre: "0",
        post: "0",
      };
      entry[field] = row.uiTokenAmount.amount;
      tokenRows.set(row.accountIndex, entry);
    }
  }
  const state = status?.value?.[0];
  return {
    signature,
    signatures: tx.transaction.signatures,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    version: tx.version ?? "legacy",
    ok: !meta.err,
    err: meta.err ?? null,
    fee: String(meta.fee ?? 0),
    computeUnits: meta.computeUnitsConsumed ?? null,
    recentBlockhash: message.recentBlockhash,
    confirmation: state?.confirmationStatus ?? null,
    confirmations: state?.confirmations ?? null,
    accounts: keys.map((key, i) => ({
      ...key,
      name: PROGRAM_NAMES[key.pubkey] || null,
      pre: String(meta.preBalances?.[i] ?? 0),
      post: String(meta.postBalances?.[i] ?? 0),
    })),
    instructions: message.instructions.map((ix, i) => ({ ...instruction(ix), inner: inner.get(i) || [] })),
    tokenBalances: [...tokenRows.values()],
    logs: meta.logMessages || [],
  };
}
