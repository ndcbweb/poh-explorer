"use client";

import { useChain } from "@/components/Shell";
import { Addr, Card, Copy, Loading, PageTitle, Row } from "@/components/ui";
import { duration, num, sol } from "@/lib/format";

const INFLATION_LABEL = {
  full: "Solana schedule: 8% a year, tapering 15% yearly to 1.5%",
  pico: "Near zero (0.0001%)",
  none: "No inflation (fixed supply)",
};

function Endpoint({ label, value }) {
  return (
    <Row label={label}>
      {value ? (
        <span className="inline-flex items-center gap-1">
          <span className="mono">{value}</span>
          <Copy text={value} />
        </span>
      ) : (
        <span className="text-muted">Not public yet</span>
      )}
    </Row>
  );
}

export default function Network() {
  const { info } = useChain();
  if (!info) return <Loading />;
  const rules = info.rules || {};
  const symbol = info.symbol;
  const rpc = info.rpcUrl || (typeof window !== "undefined" ? "https://YOUR-RPC-DOMAIN" : "");
  const epochSecs = rules.slotsPerEpoch && rules.slotMs ? (rules.slotsPerEpoch * rules.slotMs) / 1000 : null;

  return (
    <>
      <PageTitle title="Network" sub={`${info.chainName} · Proof of History + Proof of Stake (Solana runtime)`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Connect">
          <Endpoint label="JSON-RPC" value={info.rpcUrl} />
          <Endpoint label="WebSocket" value={info.wsUrl} />
          <Row label="Genesis hash">
            <span className="inline-flex items-center gap-1">
              <span className="mono">{info.genesisHash || "–"}</span>
              {info.genesisHash ? <Copy text={info.genesisHash} /> : null}
            </span>
          </Row>
          <Row label="Node software">{info.version ? `Agave ${info.version}` : rules.client || "–"}</Row>
          <Row label="Feature set">{info.featureSet ?? "–"}</Row>
          <Row label="Native token">
            {info.currencyName} ({symbol}), 9 decimals
          </Row>
        </Card>

        <Card title="Consensus rules">
          <Row label="Slot time">{rules.slotMs ? `${rules.slotMs} ms` : "–"}</Row>
          <Row label="Ticks per slot">{rules.ticksPerSlot ?? "–"}</Row>
          <Row label="Slots per epoch">
            {rules.slotsPerEpoch ? num(rules.slotsPerEpoch) : "–"}
            {epochSecs ? <span className="text-muted"> (about {duration(epochSecs)})</span> : null}
          </Row>
          <Row label="Warmup epochs">{rules.warmupEpochs ? "Yes, short epochs at launch" : "No"}</Row>
          <Row label="Optimistic confirmation">About {rules.slotMs ? ((rules.slotMs * 32) / 1000).toFixed(1) : "13"} s to finalized (32 slots)</Row>
          <Row label="Genesis validators">{rules.validators ?? "–"}</Row>
          <Row label="Stake per genesis validator">{rules.stakePerValidator ? `${sol(rules.stakePerValidator)} ${symbol}` : "–"}</Row>
          <Row label="Default commission">{rules.commission != null ? `${rules.commission}%` : "–"}</Row>
        </Card>

        <Card title="Economics">
          <Row label="Genesis supply">{rules.totalSupply ? `${sol(rules.totalSupply)} ${symbol}` : "–"}</Row>
          <Row label="Treasury">{rules.treasury ? <Addr id={rules.treasury} full /> : "–"}</Row>
          <Row label="Treasury allocation">{rules.treasuryLamports ? `${sol(rules.treasuryLamports)} ${symbol}` : "–"}</Row>
          <Row label="Fee per signature">
            {rules.lamportsPerSignature != null ? `${num(rules.lamportsPerSignature)} lamports (${sol(String(rules.lamportsPerSignature))} ${symbol})` : "–"}
          </Row>
          <Row label="Fees burned">{rules.feeBurn != null ? `${rules.feeBurn}%` : "–"}</Row>
          <Row label="Inflation">{INFLATION_LABEL[rules.inflation] || "–"}</Row>
        </Card>

        <Card title="Quickstart">
          <div className="space-y-4 px-5 pb-5 text-sm">
            <div>
              <div className="label mb-2">Solana CLI</div>
              <pre className="code">{`solana config set --url ${rpc}
solana-keygen new -o wallet.json
solana balance
solana transfer <RECIPIENT> 1 --allow-unfunded-recipient`}</pre>
            </div>
            <div>
              <div className="label mb-2">@solana/web3.js</div>
              <pre className="code">{`import { Connection } from "@solana/web3.js";

const connection = new Connection("${rpc}", "confirmed");
console.log(await connection.getSlot());`}</pre>
            </div>
            <div>
              <div className="label mb-2">Create a token</div>
              <pre className="code">{`spl-token create-token --url ${rpc}
spl-token create-account <MINT>
spl-token mint <MINT> 1000000`}</pre>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
