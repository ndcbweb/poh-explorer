"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useChain } from "@/components/Shell";
import { TxsTable } from "@/components/tables";
import { Addr, Card, Copy, ErrorBox, Loading, PageTitle, Row, Tabs } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, date, num, sol } from "@/lib/format";

function BlockView() {
  const id = useSearchParams().get("id") || "";
  const { info } = useChain();
  const [tab, setTab] = useState("user");
  useEffect(() => setTab("user"), [id]);
  const { data, error, loading } = useApi(id ? `/block/${encodeURIComponent(id)}` : null);
  const symbol = info?.symbol || "";

  if (!id) return <ErrorBox message="No slot selected" />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} />;
  const b = data.block;
  const shown = tab === "user" ? b.txs.filter((tx) => !tx.vote) : tab === "votes" ? b.txs.filter((tx) => tx.vote) : b.txs;

  return (
    <>
      <PageTitle
        title={`Slot #${num(b.slot)}`}
        sub={
          <>
            <span className="mono truncate">{b.blockhash}</span>
            <Copy text={b.blockhash} />
          </>
        }
      >
        <div className="flex gap-2">
          <Link className="btn-ghost" href={`/block/?id=${b.parentSlot}`} aria-disabled={b.slot === 0} style={b.slot === 0 ? { pointerEvents: "none", opacity: 0.4 } : undefined}>
            ← Parent
          </Link>
          <Link
            className="btn-ghost"
            href={b.nextSlot != null ? `/block/?id=${b.nextSlot}` : "#"}
            aria-disabled={b.nextSlot == null}
            style={b.nextSlot == null ? { pointerEvents: "none", opacity: 0.4 } : undefined}
          >
            Child →
          </Link>
        </div>
      </PageTitle>

      <Card className="mb-6">
        <Row label="Slot">{num(b.slot)}</Row>
        <Row label="Block height">{b.blockHeight == null ? "–" : num(b.blockHeight)}</Row>
        <Row label="Timestamp">
          {date(b.blockTime)} <span className="text-muted">({ago(b.blockTime)})</span>
        </Row>
        <Row label="Leader">
          <Addr id={b.leader} full copy />
        </Row>
        <Row label="Confirmations">{num(b.confirmations)} slots</Row>
        <Row label="Blockhash">
          <span className="mono">{b.blockhash}</span>
        </Row>
        <Row label="Parent slot">
          <Link className="link" href={`/block/?id=${b.parentSlot}`}>
            {num(b.parentSlot)}
          </Link>
          {b.slot - b.parentSlot > 1 ? <span className="ml-2 text-muted">({b.slot - b.parentSlot - 1} skipped before this)</span> : null}
        </Row>
        <Row label="Previous blockhash">
          <span className="mono">{b.previousBlockhash}</span>
        </Row>
        <Row label="Transactions">
          {num(b.txCount)} <span className="text-muted">({num(b.txCount - b.voteCount)} user, {num(b.voteCount)} votes{b.failed ? `, ${b.failed} failed` : ""})</span>
        </Row>
        <Row label="Fees">
          {sol(b.fees)} {symbol}
        </Row>
        <Row label="Leader reward">
          {sol(b.leaderReward)} {symbol} <span className="text-muted">(fees minus the burned share)</span>
        </Row>
        {b.computeUnits != null ? <Row label="Compute units">{num(b.computeUnits)}</Row> : null}
      </Card>

      <Card
        title="Transactions"
        action={
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "user", label: `User (${b.txCount - b.voteCount})` },
              { id: "votes", label: `Votes (${b.voteCount})` },
              { id: "all", label: `All (${b.txCount})` },
            ]}
          />
        }
      >
        <TxsTable txs={shown} symbol={symbol} showSlot={false} empty="No transactions of this kind in this block" />
      </Card>

      {b.rewards.length ? (
        <Card title="Rewards" className="mt-6">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="text-right">Amount ({symbol})</th>
                  <th className="text-right">New balance</th>
                </tr>
              </thead>
              <tbody>
                {b.rewards.map((reward) => (
                  <tr key={`${reward.pubkey}-${reward.type}`}>
                    <td>
                      <Addr id={reward.pubkey} />
                    </td>
                    <td>
                      <span className="chip">{reward.type}</span>
                    </td>
                    <td className="text-right tabular-nums">{sol(reward.lamports)}</td>
                    <td className="text-right tabular-nums">{sol(reward.postBalance, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}

export default function BlockPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BlockView />
    </Suspense>
  );
}
