"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useChain } from "@/components/Shell";
import { Addr, Card, Copy, ErrorBox, Loading, PageTitle, Row, Status } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, date, num, sol, units } from "@/lib/format";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Parsed instruction fields: addresses become links, nested objects are shown as JSON. */
function InfoValue({ value, symbol, field }) {
  if (value == null) return <span className="text-muted">–</span>;
  if (typeof value === "string" && BASE58.test(value)) return <Addr id={value} full />;
  if (field === "lamports") {
    return (
      <span className="tabular-nums">
        {sol(value)} {symbol}
      </span>
    );
  }
  if (typeof value === "object") {
    if (value.uiAmountString != null) return <span className="tabular-nums">{value.uiAmountString}</span>;
    return <pre className="code !p-2 text-[12px]">{JSON.stringify(value, null, 2)}</pre>;
  }
  return <span className="break-all">{String(value)}</span>;
}

function Instruction({ ix, index, symbol, inner = false }) {
  return (
    <div className={`border-t border-black/5 px-5 py-4 first:border-t-0 dark:border-white/5 ${inner ? "ml-6 border-l-2 border-l-brand/30" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="chip">#{index}</span>
        <Addr id={ix.programId} name={ix.programName || undefined} />
        {ix.type ? <span className="chip">{ix.type}</span> : null}
      </div>
      {ix.info ? (
        <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[180px_1fr]">
          {Object.entries(ix.info).map(([key, value]) => (
            <div key={key} className="contents">
              <div className="text-muted">{key}</div>
              <div className="min-w-0">
                <InfoValue value={value} symbol={symbol} field={key} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {ix.accounts?.length ? (
            <div className="flex flex-wrap gap-2">
              {ix.accounts.map((account, i) => (
                <span key={`${account}-${i}`} className="chip">
                  <Addr id={account} />
                </span>
              ))}
            </div>
          ) : null}
          {ix.data ? <div className="code break-all !whitespace-normal">{ix.data}</div> : null}
        </div>
      )}
    </div>
  );
}

function TxView() {
  const id = useSearchParams().get("id") || "";
  const { info } = useChain();
  const { data, error, loading } = useApi(id ? `/tx/${encodeURIComponent(id)}` : null);
  const symbol = info?.symbol || "";

  if (!id) return <ErrorBox message="No transaction selected" />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} />;
  const tx = data.tx;

  return (
    <>
      <PageTitle
        title="Transaction"
        sub={
          <>
            <span className="mono truncate">{tx.signature}</span>
            <Copy text={tx.signature} />
          </>
        }
      />

      <Card className="mb-6">
        <Row label="Signature">
          <span className="mono">{tx.signature}</span>
        </Row>
        <Row label="Result">
          <div className="flex flex-wrap items-center gap-2">
            <Status ok={tx.ok} />
            {tx.confirmation ? <span className="chip capitalize">{tx.confirmation}</span> : null}
            {tx.err ? <span className="mono text-down">{JSON.stringify(tx.err)}</span> : null}
          </div>
        </Row>
        <Row label="Slot">
          <Link className="link" href={`/block/?id=${tx.slot}`}>
            {num(tx.slot)}
          </Link>
        </Row>
        <Row label="Timestamp">
          {date(tx.blockTime)} <span className="text-muted">({ago(tx.blockTime)})</span>
        </Row>
        <Row label="Fee">
          {sol(tx.fee)} {symbol}
        </Row>
        <Row label="Compute units consumed">{tx.computeUnits == null ? "–" : num(tx.computeUnits)}</Row>
        <Row label="Version">{String(tx.version)}</Row>
        <Row label="Recent blockhash">
          <span className="mono">{tx.recentBlockhash}</span>
        </Row>
        {tx.signatures.length > 1 ? (
          <Row label="Signatures">
            {tx.signatures.map((sig) => (
              <div key={sig} className="mono">
                {sig}
              </div>
            ))}
          </Row>
        ) : null}
      </Card>

      <Card title={`Account inputs (${tx.accounts.length})`} className="mb-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Address</th>
                <th>Role</th>
                <th className="text-right">Change ({symbol})</th>
                <th className="text-right">Post balance</th>
              </tr>
            </thead>
            <tbody>
              {tx.accounts.map((account, i) => {
                const delta = BigInt(account.post) - BigInt(account.pre);
                return (
                  <tr key={`${account.pubkey}-${i}`}>
                    <td className="text-muted">{i}</td>
                    <td>
                      <Addr id={account.pubkey} name={account.name || undefined} head={8} tail={8} />
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {account.signer ? <span className="chip">Signer</span> : null}
                        {account.writable ? <span className="chip">Writable</span> : null}
                        {i === 0 ? <span className="chip">Fee payer</span> : null}
                        {account.source === "lookupTable" ? <span className="chip">Lookup table</span> : null}
                      </div>
                    </td>
                    <td className={`text-right tabular-nums ${delta > 0n ? "text-up" : delta < 0n ? "text-down" : "text-muted"}`}>
                      {delta > 0n ? "+" : ""}
                      {sol(delta.toString())}
                    </td>
                    <td className="text-right tabular-nums">{sol(account.post, 4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {tx.tokenBalances.length ? (
        <Card title="Token balance changes" className="mb-6">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Token account</th>
                  <th>Owner</th>
                  <th>Mint</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Post balance</th>
                </tr>
              </thead>
              <tbody>
                {tx.tokenBalances.map((row) => {
                  const delta = BigInt(row.post) - BigInt(row.pre);
                  return (
                    <tr key={row.account}>
                      <td>
                        <Addr id={row.account} />
                      </td>
                      <td>
                        <Addr id={row.owner} />
                      </td>
                      <td>
                        <Addr id={row.mint} />
                      </td>
                      <td className={`text-right tabular-nums ${delta > 0n ? "text-up" : delta < 0n ? "text-down" : "text-muted"}`}>
                        {delta > 0n ? "+" : ""}
                        {units(delta.toString(), row.decimals)}
                      </td>
                      <td className="text-right tabular-nums">{units(row.post, row.decimals)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card title={`Instructions (${tx.instructions.length})`} className="mb-6">
        {tx.instructions.map((ix, i) => (
          <div key={i}>
            <Instruction ix={ix} index={i + 1} symbol={symbol} />
            {ix.inner.map((innerIx, j) => (
              <Instruction key={j} ix={innerIx} index={`${i + 1}.${j + 1}`} symbol={symbol} inner />
            ))}
          </div>
        ))}
      </Card>

      {tx.logs.length ? (
        <Card title="Program logs">
          <div className="px-5 pb-5">
            <pre className="code">{tx.logs.join("\n")}</pre>
          </div>
        </Card>
      ) : null}
    </>
  );
}

export default function TxPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TxView />
    </Suspense>
  );
}
