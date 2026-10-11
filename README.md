# Nadcab PoH Explorer

Block explorer for Proof of History + Proof of Stake chains deployed from Nadcab Console
(Agave / Solana runtime, image [`ndcbweb/poh-chain`](https://github.com/ndcbweb/poh-chain)).

- `server/` — Fastify API that reads a Solana JSON-RPC node (`RPC_URL`). No database: the RPC node keeps
  transaction history and token indexes, the server caches hot calls in memory.
- `web/` — Next.js static export with Tailwind, light and dark themes. Pages: home, blocks, slot, transactions,
  transaction, address (wallet, token mint, token account, vote, stake, program), validators, tokens, supply,
  network.

## Environment

| Variable | Meaning |
| --- | --- |
| `RPC_URL` | RPC node with `--full-rpc-api --enable-rpc-transaction-history` and SPL token indexes |
| `PORT` | HTTP port (default 4300) |
| `DATA_DIR` | Branding lives in `DATA_DIR/branding/settings.json` plus logo/favicon files |
| `CHAIN_FILE` | Genesis rules JSON written by the console (slot time, epochs, fees, treasury, RPC URLs) |
| `CHAIN_NAME`, `CURRENCY_SYMBOL`, `CURRENCY_NAME` | Defaults when branding leaves them empty |

## Release

Every push to `main` builds `dist/explorer.tar.gz`, runs `test/e2e.sh` against a live Agave cluster and
uploads the bundle to the `latest` release. Hosts run it with `node:22-alpine sh /app/run.sh`.
