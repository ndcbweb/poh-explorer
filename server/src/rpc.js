import { ENV } from "./config.js";

export class RpcError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

let nextId = 1;
/** Lamport amounts beyond 2^53 (a 500M-coin supply is 5e17 lamports) would lose precision as JS numbers. */
const BIG_INT = /([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g;

/** One Solana JSON-RPC call against the cluster's RPC node. */
export async function rpc(method, params = [], { timeoutMs = 10_000 } = {}) {
  const res = await fetch(ENV.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await res.text().catch(() => "");
  let body = null;
  for (const text of [raw.replace(BIG_INT, '$1"$2"'), raw]) {
    try {
      body = JSON.parse(text);
      break;
    } catch {
      body = null;
    }
  }
  if (!body) throw new RpcError(-32000, `RPC returned HTTP ${res.status}`);
  if (body.error) throw new RpcError(body.error.code, body.error.message);
  return body.result;
}

/** Caches a loader for `ms`, sharing one in-flight request between callers. */
export function memo(ms, load) {
  let value;
  let at = 0;
  let pending = null;
  return async () => {
    if (value !== undefined && Date.now() - at < ms) return value;
    pending ||= load()
      .then((result) => {
        value = result;
        at = Date.now();
        return result;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}

/** Runs `fn` over `items` with at most `limit` calls in flight. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
