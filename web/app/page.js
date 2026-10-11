"use client";

import Link from "next/link";
import { SearchBar, useChain } from "@/components/Shell";
import { BlocksTable, TxsTable } from "@/components/tables";
import { Card, ErrorBox, Loading, Spark, Stat } from "@/components/ui";
import { useApi } from "@/lib/api";
import { compact, duration, num, percent, share, solCompact } from "@/lib/format";

function EpochBar({ overview }) {
  const done = overview.slotsInEpoch ? overview.slotIndex / overview.slotsInEpoch : 0;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="label">Epoch {num(overview.epoch)}</div>
        <div className="text-xs text-muted">{duration(overview.epochEtaSecs)} left</div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-mint" style={{ width: `${(done * 100).toFixed(2)}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
        <span>
          {num(overview.slotIndex)} / {num(overview.slotsInEpoch)} slots
        </span>
        <span>{percent(done, 1)}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { info } = useChain();
  const symbol = info?.symbol || "";
  const { data: overview, error } = useApi("/overview", { refreshMs: 2000 });
  const { data: home } = useApi("/home", { refreshMs: 3000 });
  const branding = info?.branding || {};

  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl px-6 py-10 sm:px-10"
        style={{
          background: branding.heroColor
            ? branding.heroColor
            : "linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 22%, transparent), color-mix(in srgb, var(--color-mint) 14%, transparent))",
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{branding.heroTitle || `${info?.chainName || ""} Explorer`}</h1>
        <p className="mt-2 text-sm text-muted">
          {branding.heroSubtitle || "Proof of History + Proof of Stake. Slots, transactions, accounts, tokens and validators in real time."}
        </p>
        <div className="mt-6 max-w-2xl">
          <SearchBar large />
        </div>
      </section>

      {error && !overview ? <ErrorBox message={error} /> : null}
      {!overview && !error ? <Loading /> : null}

      {overview ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Slot" value={num(overview.slot)} sub={`Block height ${num(overview.blockHeight)}`} accent />
            <Stat
              label="Transactions per second"
              value={overview.tps == null ? "–" : num(Math.round(overview.tps))}
              sub={overview.userTps == null ? "Sampled every minute" : `${overview.userTps.toFixed(2)} non-vote TPS`}
            />
            <Stat
              label="Slot time"
              value={overview.slotMs ? `${Math.round(overview.slotMs)} ms` : `${info?.rules?.slotMs ?? "–"} ms`}
              sub={`Target ${info?.rules?.slotMs ?? 400} ms`}
            />
            <Stat
              label="Total transactions"
              value={overview.transactionCount == null ? "–" : compact(overview.transactionCount)}
              sub="Since genesis, votes included"
            />
            <Stat
              label="Circulating supply"
              value={overview.supply ? `${solCompact(overview.supply.circulating)} ${symbol}` : "–"}
              sub={overview.supply ? `of ${solCompact(overview.supply.total)} total` : ""}
            />
            <Stat
              label="Active stake"
              value={`${solCompact(overview.validators.stake.active)} ${symbol}`}
              sub={overview.supply ? `${share(overview.validators.stake.active, overview.supply.total).toFixed(2)}% of supply` : ""}
            />
            <Stat
              label="Validators"
              value={num(overview.validators.current)}
              sub={overview.validators.delinquent ? `${overview.validators.delinquent} delinquent` : "All voting"}
            />
            <Stat
              label="Inflation"
              value={overview.inflation ? percent(overview.inflation.total) : "–"}
              sub={overview.inflation ? `Epoch ${overview.inflation.epoch} rate` : ""}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <EpochBar overview={overview} />
            <Card title="TPS (last hour)" className="lg:col-span-2" bodyClass="px-5 pb-4">
              <Spark values={overview.series.map((row) => row.tps)} height={80} />
            </Card>
          </div>
        </>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Latest blocks"
          action={
            <Link href="/blocks/" className="btn-ghost">
              View all
            </Link>
          }
        >
          {home ? <BlocksTable blocks={home.blocks} symbol={symbol} /> : <Loading />}
        </Card>
        <Card
          title="Latest transactions"
          action={
            <Link href="/txs/" className="btn-ghost">
              View all
            </Link>
          }
        >
          {home ? <TxsTable txs={home.txs} symbol={symbol} empty="No user transactions in recent blocks" /> : <Loading />}
        </Card>
      </div>
    </div>
  );
}
