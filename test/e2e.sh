#!/usr/bin/env bash
# Boots a 1-validator Agave cluster plus an RPC node from nadcab/poh-chain:latest, puts a transfer and an SPL
# token on it, then runs the built explorer bundle against the RPC node and checks every API and page.
set -euo pipefail
cd "$(dirname "$0")/.."

image=nadcab/poh-chain:latest
work=$(mktemp -d)
host_ip=$(hostname -I | awk '{print $1}')
rpc_url="http://$host_ip:8545"
explorer=http://127.0.0.1:4300

sudo sysctl -qw vm.max_map_count=1000000 fs.nr_open=1000000 \
  net.core.rmem_max=134217728 net.core.rmem_default=134217728 \
  net.core.wmem_max=134217728 net.core.wmem_default=134217728

cleanup() {
  status=$?
  if (( status != 0 )); then
    for name in poh-v1 poh-rpc; do
      echo "===== $name (last 60 lines)"
      docker logs --tail 60 "$name" 2>&1 || true
    done
    echo "===== explorer"
    cat "$work/explorer.log" 2>/dev/null || true
  fi
  [[ -n ${server_pid:-} ]] && kill "$server_pid" 2>/dev/null || true
  docker rm -f poh-v1 poh-rpc >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

call() {
  curl -sf --max-time 10 "$rpc_url" -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":${2:-[]}}"
}
api() {
  curl -sf --max-time 30 "$explorer/api/$1"
}
check() {
  local label=$1 expr=$2 body=$3
  if ! echo "$body" | jq -e "$expr" >/dev/null; then
    echo "FAIL: $label"
    echo "$body" | head -c 3000
    echo
    exit 1
  fi
  echo "ok: $label"
}

treasury=$(node test/keypair.mjs "$work/treasury.json")
mkdir -p "$work/validators" "$work/rpc"
docker run --rm -v "$work/validators:/data" \
  -e VALIDATORS=1 -e TREASURY_PUBKEY="$treasury" -e TREASURY_LAMPORTS=500000000000000000 \
  -e STAKE_LAMPORTS=100000000000000 -e SLOTS_PER_EPOCH=8192 -e COMMISSION=10 \
  "$image" poh-genesis
genesis_hash=$(sudo jq -r .genesisHash "$work/validators/cluster.json")
identity=$(sudo jq -r '.validators[0].identity' "$work/validators/cluster.json")

docker run -d --name poh-v1 --network host --ulimit nofile=1000000:1000000 \
  -e HOST_IP="$host_ip" -v "$work/validators:/data" "$image" poh-validator 1
docker run -d --name poh-rpc --network host --ulimit nofile=1000000:1000000 \
  -e HOST_IP="$host_ip" -e ENTRY_IP="$host_ip" -e GOSSIP_PORT=8601 -e DYNAMIC_PORT_RANGE=8602-8640 \
  -v "$work/rpc:/data" "$image" poh-rpc

echo "Waiting for the RPC node"
for attempt in $(seq 1 120); do
  slot=$(call getSlot | jq -r '.result // 0' 2>/dev/null || echo 0)
  [[ $slot -gt 20 ]] && break
  sleep 5
done
[[ $slot -gt 20 ]]
echo "rpc at slot $slot"

(cd test && npm install --no-audit --no-fund --silent)
activity=$(node test/activity.mjs "$rpc_url" "$work/treasury.json")
echo "activity $activity"
recipient=$(echo "$activity" | jq -r .recipient)
transfer_sig=$(echo "$activity" | jq -r .transferSig)
token_sig=$(echo "$activity" | jq -r .tokenSig)
mint=$(echo "$activity" | jq -r .mint)

mkdir -p "$work/explorer-data/branding"
cat > "$work/chain.json" <<CHAIN
{"name":"Poh Test Chain","ticker":"PTC","decimals":9,"slotMs":400,"ticksPerSlot":64,"slotsPerEpoch":8192,
 "validators":1,"commission":10,"inflation":"full","lamportsPerSignature":5000,"feeBurn":50,
 "treasury":"$treasury","totalSupply":"600000000000000000","rpcUrl":"https://rpc.example.com","wsUrl":"wss://rpc.example.com"}
CHAIN
echo '{"chainName":"Branded Chain","brandColor":"#14f195","logo":"logo.png","version":"3"}' > "$work/explorer-data/branding/settings.json"
printf '\x89PNG\r\n\x1a\n' > "$work/explorer-data/branding/logo.png"

PORT=4300 RPC_URL="$rpc_url" CHAIN_FILE="$work/chain.json" DATA_DIR="$work/explorer-data" \
  CHAIN_NAME="Poh Test Chain" CURRENCY_SYMBOL=PTC WEB_DIR="$PWD/dist/explorer/web/out" \
  node dist/explorer/server/src/index.js > "$work/explorer.log" 2>&1 &
server_pid=$!
for attempt in $(seq 1 30); do
  curl -sf "$explorer/api/health" >/dev/null && break
  sleep 1
done

check "health" '.ok == true and .indexed > 0 and .indexed == .chainHead' "$(api health)"
check "info" ".genesisHash == \"$genesis_hash\" and .chainName == \"Branded Chain\" and .symbol == \"PTC\" and .rules.treasury == \"$treasury\" and (.version | length) > 0 and (.branding.logoUrl | startswith(\"/branding/logo.png\"))" "$(api info)"
check "overview" '.slot > 0 and .validators.current == 1 and (.supply.total | tonumber) > 0 and .epoch >= 0' "$(api overview)"
check "home" ".blocks | length > 0" "$(api home)"
check "blocks" ".blocks | length == 5 and all(.[]; .leader == \"$identity\")" "$(api 'blocks?limit=5')"

tx=$(api "tx/$transfer_sig")
check "transfer tx" ".tx.ok and .tx.fee == \"5000\" and .tx.instructions[0].type == \"transfer\" and .tx.instructions[0].program == \"system\"" "$tx"
tx_slot=$(echo "$tx" | jq -r .tx.slot)
check "block with the transfer" "any(.block.txs[]; .signature == \"$transfer_sig\" and .vote == false) and .block.voteCount >= 0" "$(api "block/$tx_slot")"
check "token tx" ".tx.ok and (.tx.tokenBalances | length) == 2 and any(.tx.instructions[]; .type == \"transfer\")" "$(api "tx/$token_sig")"

check "wallet" ".account.kind == \"wallet\" and .account.lamports == \"3000000000\" and any(.history[]; .signature == \"$transfer_sig\") and (.tokens | length) == 1 and .tokens[0].amount == \"250000000\"" "$(api "address/$recipient")"
check "mint" ".account.kind == \"mint\" and .account.mint.decimals == 6 and .account.mint.supply == \"1000000000\" and .account.mint.holders == 2 and (.account.largest | length) == 2" "$(api "address/$mint")"
check "vote account" '.account.kind == "vote" and .account.vote.commission == 10' "$(api "address/$(sudo jq -r '.validators[0].vote' "$work/validators/cluster.json")")"
check "program" '.account.kind == "program"' "$(api address/TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA)"
check "tokens" "any(.tokens[]; .mint == \"$mint\")" "$(api tokens)"
check "validators" ".validators | length == 1 and .[0].identity == \"$identity\" and .[0].commission == 10" "$(api validators)"
check "supply" ".treasury.address == \"$treasury\" and (.treasury.balance | tonumber) > 0 and (.total | tonumber) > 0" "$(api supply)"
check "txs" "any(.txs[]; .signature == \"$token_sig\")" "$(api 'txs?limit=25')"
check "search slot" '.type == "block"' "$(api "search?q=$tx_slot")"
check "search tx" '.type == "tx"' "$(api "search?q=$transfer_sig")"
check "search address" '.type == "address"' "$(api "search?q=$recipient")"

for page in / /blocks/ /txs/ /tx/ /address/ /block/ /validators/ /tokens/ /supply/ /network/; do
  curl -sf "$explorer$page" | grep -q "<html" || { echo "FAIL: page $page"; exit 1; }
done
echo "ok: pages"
curl -sf "$explorer/branding/logo.png" >/dev/null && echo "ok: branding asset"
[[ $(curl -s -o /dev/null -w '%{http_code}' "$explorer/api/tx/notasignature") == 400 ]] && echo "ok: bad input"
echo "e2e passed"
