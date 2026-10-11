import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;

/** Genesis rules written by Nadcab Console (slot time, epochs, inflation, treasury…). */
function readChainFile(path) {
  if (!path || !existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

const chain = readChainFile(env.CHAIN_FILE);

export const ENV = {
  port: Number(env.PORT) || 4300,
  dataDir: resolve(env.DATA_DIR || resolve(here, "../.data")),
  webDir: resolve(env.WEB_DIR || resolve(here, "../../web/out")),
  rpcUrl: (env.RPC_URL || "http://127.0.0.1:8899").replace(/\/+$/, ""),
  publicRpcUrl: env.PUBLIC_RPC_URL || "",
  chain,
  chainName: env.CHAIN_NAME || chain.name || "Solana Cluster",
  symbol: env.CURRENCY_SYMBOL || chain.ticker || "SOL",
  currencyName: env.CURRENCY_NAME || chain.name || "",
};
