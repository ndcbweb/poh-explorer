import fs from "node:fs";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { ENV } from "./config.js";
import { mapLimit, memo, rpc, RpcError } from "./rpc.js";
import { assetUrl, BRANDING_DIR, getSettings } from "./settings.js";
import {
  blockDetail,
  blockSummary,
  describeAccount,
  isAddress,
  isSignature,
  listMints,
  recentSlots,
  tokenHoldings,
  transaction,
} from "./solana.js";

const app = Fastify({ trustProxy: "127.0.0.1", logger: { level: "warn" } });

app.addHook("onSend", async (request, reply, payload) => {
  reply.header(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
  );
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "strict-origin-when-cross-origin");
  return payload;
});

await app.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: "1 minute",
  allowList: (request) => request.url === "/api/health",
});

/** Solana RPC codes for slots the node cannot serve: skipped, not yet confirmed, or pruned from the ledger. */
const MISSING_CODES = new Set([-32004, -32007, -32009, -32014]);

app.setErrorHandler((error, request, reply) => {
  if (error instanceof RpcError) {
    if (MISSING_CODES.has(error.code)) return reply.code(404).send({ ok: false, error: error.message });
    if (error.code === -32602) return reply.code(400).send({ ok: false, error: error.message });
    return reply.code(502).send({ ok: false, error: error.message });
  }
  if (error.name === "TimeoutError" || error.message === "fetch failed") {
    return reply.code(503).send({ ok: false, error: "The RPC node is not reachable right now" });
  }
  reply.code(error.statusCode || 500).send({ ok: false, error: error.message || "Request failed" });
});

const clampLimit = (value, fallback, max) => Math.min(max, Math.max(1, Number(value) || fallback));
const tipSlot = memo(400, () => rpc("getSlot", [{ commitment: "confirmed" }]));
const genesisHash = memo(3_600_000, () => rpc("getGenesisHash"));
const version = memo(60_000, () => rpc("getVersion"));
const epochInfo = memo(1000, () => rpc("getEpochInfo", [{ commitment: "confirmed" }]));
const supply = memo(30_000, () => rpc("getSupply", [{ commitment: "confirmed", excludeNonCirculatingAccountsList: true }]));
const voteAccounts = memo(10_000, () => rpc("getVoteAccounts", [{ commitment: "confirmed" }]));
const clusterNodes = memo(30_000, () => rpc("getClusterNodes"));
const samples = memo(30_000, () => rpc("getRecentPerformanceSamples", [60]));
const inflationRate = memo(60_000, () => rpc("getInflationRate"));
const inflationGovernor = memo(600_000, () => rpc("getInflationGovernor"));
const epochSchedule = memo(3_600_000, () => rpc("getEpochSchedule"));
const blockProduction = memo(30_000, () => rpc("getBlockProduction", [{ commitment: "confirmed" }]));
const largestAccounts = memo(300_000, () => rpc("getLargestAccounts", [{ commitment: "confirmed" }], { timeoutMs: 30_000 }));
const mints = memo(30_000, listMints);

function stakeTotals(votes) {
  const sum = (rows) => rows.reduce((total, row) => total + BigInt(row.activatedStake ?? 0), 0n);
  return { active: sum(votes.current).toString(), delinquent: sum(votes.delinquent).toString() };
}

app.get("/api/health", async () => {
  try {
    const slot = await tipSlot();
    return { ok: slot > 0, indexed: slot, chainHead: slot, syncing: false };
  } catch (error) {
    return { ok: false, indexed: 0, chainHead: 0, error: error.message };
  }
});

app.get("/api/info", async () => {
  const settings = getSettings();
  const [hash, node] = await Promise.all([genesisHash().catch(() => null), version().catch(() => null)]);
  return {
    chainName: settings.chainName || ENV.chainName,
    symbol: settings.currencySymbol || ENV.symbol,
    currencyName: settings.currencyName || ENV.currencyName || ENV.chainName,
    decimals: 9,
    branding: { ...settings, logoUrl: assetUrl(settings, "logo"), faviconUrl: assetUrl(settings, "favicon") },
    rules: ENV.chain,
    rpcUrl: ENV.chain.rpcUrl || ENV.publicRpcUrl || "",
    wsUrl: ENV.chain.wsUrl || "",
    genesisHash: hash,
    version: node?.["solana-core"] || null,
    featureSet: node?.["feature-set"] ?? null,
  };
});

app.get("/api/overview", async () => {
  const [epoch, sup, votes, perf, rate] = await Promise.all([
    epochInfo(),
    supply().catch(() => null),
    voteAccounts().catch(() => ({ current: [], delinquent: [] })),
    samples().catch(() => []),
    inflationRate().catch(() => null),
  ]);
  const series = perf
    .filter((row) => row.samplePeriodSecs > 0)
    .map((row) => ({
      slot: row.slot,
      tps: row.numTransactions / row.samplePeriodSecs,
      userTps: (row.numNonVoteTransactions ?? 0) / row.samplePeriodSecs,
      slotMs: row.numSlots ? (row.samplePeriodSecs * 1000) / row.numSlots : null,
    }))
    .reverse();
  const latest = series.at(-1) || null;
  const slotMs = latest?.slotMs || ENV.chain.slotMs || 400;
  const slotsLeft = epoch.slotsInEpoch - epoch.slotIndex;
  return {
    slot: epoch.absoluteSlot,
    blockHeight: epoch.blockHeight,
    epoch: epoch.epoch,
    slotIndex: epoch.slotIndex,
    slotsInEpoch: epoch.slotsInEpoch,
    epochEtaSecs: (slotsLeft * slotMs) / 1000,
    transactionCount: epoch.transactionCount ?? null,
    supply: sup ? { total: String(sup.value.total), circulating: String(sup.value.circulating), nonCirculating: String(sup.value.nonCirculating) } : null,
    validators: { current: votes.current.length, delinquent: votes.delinquent.length, stake: stakeTotals(votes) },
    tps: latest?.tps ?? null,
    userTps: latest?.userTps ?? null,
    slotMs: latest?.slotMs ?? null,
    series,
    inflation: rate,
  };
});

app.get("/api/home", async () => {
  const tip = await tipSlot();
  const slots = await recentSlots(tip, 60);
  const blocks = [];
  const txs = [];
  for (let i = 0; i < slots.length; i += 6) {
    const batch = await mapLimit(slots.slice(i, i + 6), 6, (slot) => blockSummary(slot).catch(() => null));
    for (const block of batch.filter(Boolean)) {
      if (blocks.length < 10) blocks.push({ ...block, userTxs: undefined });
      for (const tx of block.userTxs) if (txs.length < 10) txs.push(tx);
    }
    if (blocks.length >= 10 && txs.length >= 10) break;
  }
  return { tip, blocks, txs };
});

app.get("/api/blocks", async (request) => {
  const limit = clampLimit(request.query.limit, 25, 50);
  const before = Number(request.query.before);
  const end = Number.isInteger(before) && before > 0 ? before - 1 : await tipSlot();
  const slots = await recentSlots(end, limit);
  const blocks = (await mapLimit(slots, 6, (slot) => blockSummary(slot).catch(() => null)))
    .filter(Boolean)
    .map((block) => ({ ...block, userTxs: undefined }));
  return { blocks, tip: await tipSlot() };
});

app.get("/api/txs", async (request) => {
  const limit = clampLimit(request.query.limit, 25, 50);
  const before = Number(request.query.before);
  let end = Number.isInteger(before) && before > 0 ? before - 1 : await tipSlot();
  const txs = [];
  let scanned = 0;
  let lastSlot = end;
  while (txs.length < limit && scanned < 400 && end >= 0) {
    const slots = await recentSlots(end, 25);
    if (!slots.length) break;
    const batch = await mapLimit(slots, 6, (slot) => blockSummary(slot).catch(() => null));
    for (const block of batch.filter(Boolean)) {
      if (txs.length >= limit) break;
      lastSlot = block.slot;
      txs.push(...block.userTxs);
    }
    scanned += 25;
    end = slots.at(-1) - 1;
  }
  return { txs, nextBefore: txs.length ? lastSlot : end > 0 ? end + 1 : null };
});

app.get("/api/block/:slot", async (request, reply) => {
  const slot = Number(request.params.slot);
  if (!Number.isInteger(slot) || slot < 0) return reply.code(400).send({ ok: false, error: "Enter a slot number" });
  const block = await blockDetail(slot);
  if (!block) return reply.code(404).send({ ok: false, error: `Slot ${slot} has no block` });
  const tip = await tipSlot();
  const nextSlots = slot < tip ? await rpc("getBlocks", [slot + 1, Math.min(tip, slot + 64), { commitment: "confirmed" }]) : [];
  return { block: { ...block, nextSlot: nextSlots[0] ?? null, confirmations: tip - slot } };
});

app.get("/api/tx/:signature", async (request, reply) => {
  const signature = String(request.params.signature).trim();
  if (!isSignature(signature)) return reply.code(400).send({ ok: false, error: "Enter an 87-88 character transaction signature" });
  const tx = await transaction(signature);
  if (!tx) return reply.code(404).send({ ok: false, error: "Transaction not found" });
  return { tx };
});

app.get("/api/address/:address", async (request, reply) => {
  const address = String(request.params.address).trim();
  if (!isAddress(address)) return reply.code(400).send({ ok: false, error: "This is not a valid address" });
  const limit = clampLimit(request.query.limit, 25, 100);
  const before = typeof request.query.before === "string" && isSignature(request.query.before) ? request.query.before : undefined;
  const [info, signatures] = await Promise.all([
    rpc("getAccountInfo", [address, { encoding: "jsonParsed", commitment: "confirmed" }]),
    rpc("getSignaturesForAddress", [address, { limit, before, commitment: "confirmed" }]).catch(() => []),
  ]);
  const account = await describeAccount(address, info.value);
  const tokens = ["wallet", "unfunded", "data", "stake", "vote"].includes(account.kind) ? await tokenHoldings(address) : [];
  return {
    address,
    account,
    tokens,
    history: signatures.map((row) => ({
      signature: row.signature,
      slot: row.slot,
      blockTime: row.blockTime ?? null,
      ok: !row.err,
      memo: row.memo ?? null,
      confirmation: row.confirmationStatus ?? null,
    })),
    nextBefore: signatures.length === limit ? signatures.at(-1).signature : null,
  };
});

app.get("/api/validators", async () => {
  const [votes, nodes, epoch, production] = await Promise.all([
    voteAccounts(),
    clusterNodes().catch(() => []),
    epochInfo(),
    blockProduction().catch(() => null),
  ]);
  const nodeVersion = new Map(nodes.map((node) => [node.pubkey, node.version]));
  const produced = production?.value?.byIdentity || {};
  const totals = stakeTotals(votes);
  const total = BigInt(totals.active) + BigInt(totals.delinquent);
  const row = (entry, delinquent) => {
    const [leaderSlots = 0, blocks = 0] = produced[entry.nodePubkey] || [];
    const credits = entry.epochCredits?.at(-1);
    return {
      identity: entry.nodePubkey,
      vote: entry.votePubkey,
      stake: String(entry.activatedStake),
      stakeShare: total > 0n ? Number((BigInt(entry.activatedStake) * 1_000_000n) / total) / 10_000 : 0,
      commission: entry.commission,
      lastVote: entry.lastVote,
      rootSlot: entry.rootSlot,
      epochCredits: credits ? String(BigInt(credits[1]) - BigInt(credits[2])) : "0",
      version: nodeVersion.get(entry.nodePubkey) || null,
      leaderSlots,
      blocksProduced: blocks,
      skipRate: leaderSlots ? 1 - blocks / leaderSlots : null,
      delinquent,
    };
  };
  const validators = [...votes.current.map((v) => row(v, false)), ...votes.delinquent.map((v) => row(v, true))].sort((a, b) =>
    BigInt(b.stake) > BigInt(a.stake) ? 1 : -1
  );
  return {
    epoch: epoch.epoch,
    slot: epoch.absoluteSlot,
    stake: totals,
    validators,
    nodes: nodes.map((node) => ({ identity: node.pubkey, version: node.version, rpc: Boolean(node.rpc), voting: validators.some((v) => v.identity === node.pubkey) })),
  };
});

app.get("/api/supply", async () => {
  const [sup, largest, rate, governor, schedule] = await Promise.all([
    supply(),
    largestAccounts().catch(() => null),
    inflationRate().catch(() => null),
    inflationGovernor().catch(() => null),
    epochSchedule().catch(() => null),
  ]);
  const treasury = ENV.chain.treasury;
  const treasuryBalance = treasury ? await rpc("getBalance", [treasury, { commitment: "confirmed" }]).catch(() => null) : null;
  return {
    total: String(sup.value.total),
    circulating: String(sup.value.circulating),
    nonCirculating: String(sup.value.nonCirculating),
    inflation: rate,
    governor,
    epochSchedule: schedule,
    treasury: treasury ? { address: treasury, balance: treasuryBalance ? String(treasuryBalance.value) : null } : null,
    largest: (largest?.value || []).map((row) => ({ address: row.address, lamports: String(row.lamports) })),
  };
});

app.get("/api/tokens", async () => ({ tokens: await mints() }));

app.get("/api/search", async (request, reply) => {
  const query = String(request.query.q || "").trim();
  if (!query) return reply.code(400).send({ ok: false, error: "Enter a slot, signature or address" });
  if (/^\d+$/.test(query)) return { type: "block", id: query };
  if (isSignature(query)) return { type: "tx", id: query };
  if (isAddress(query)) return { type: "address", id: query };
  return reply.code(404).send({ ok: false, error: "Not a slot, transaction signature or address" });
});

app.get("/api/*", async (request, reply) => reply.code(404).send({ ok: false, error: "Not found" }));

fs.mkdirSync(BRANDING_DIR, { recursive: true });
await app.register(fastifyStatic, { root: BRANDING_DIR, prefix: "/branding/", decorateReply: false, maxAge: "1d" });
await app.register(fastifyStatic, { root: ENV.webDir, prefix: "/", redirect: true });
app.setNotFoundHandler((request, reply) => reply.code(404).sendFile("404.html", ENV.webDir));

await app.listen({ port: ENV.port, host: "0.0.0.0" });
console.log(`${ENV.chainName} explorer on :${ENV.port}, RPC ${ENV.rpcUrl}`);
