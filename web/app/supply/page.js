"use client";

import { useChain } from "@/components/Shell";
import { Addr, Card, Empty, ErrorBox, Loading, PageTitle, Row, Stat } from "@/components/ui";
import { useApi } from "@/lib/api";
import { num, percent, share, sol, solCompact } from "@/lib/format";

export default function Supply() {
  const { info } = useChain();
  const symbol = info?.symbol || "";
  const { data, error } = useApi("/supply", { refreshMs: 30_000 });

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const governor = data.governor;

  return (
    <>
      <PageTitle title="Supply" sub={`${info?.currencyName || ""} (${symbol}) · 1 ${symbol} = 1,000,000,000 lamports`} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total supply" value={`${solCompact(data.total)} ${symbol}`} sub={`${sol(data.total, 2)} ${symbol}`} accent />
        <Stat label="Circulating" value={`${solCompact(data.circulating)} ${symbol}`} sub={`${share(data.circulating, data.total).toFixed(2)}% of total`} />
        <Stat label="Non-circulating" value={`${solCompact(data.nonCirculating)} ${symbol}`} sub={`${share(data.nonCirculating, data.total).toFixed(2)}% of total`} />
        <Stat label="Inflation now" value={data.inflation ? percent(data.inflation.total) : "–"} sub={data.inflation ? `Validators ${percent(data.inflation.validator)}` : ""} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Inflation schedule">
          {governor ? (
            <>
              <Row label="Initial rate">{percent(governor.initial)}</Row>
              <Row label="Yearly taper">{percent(governor.taper, 0)}</Row>
              <Row label="Long-term rate">{percent(governor.terminal)}</Row>
              <Row label="Foundation share">{percent(governor.foundation, 0)}</Row>
              <Row label="Epoch length">{data.epochSchedule ? `${num(data.epochSchedule.slotsPerEpoch)} slots` : "–"}</Row>
            </>
          ) : (
            <Empty>Inflation data is not available</Empty>
          )}
        </Card>
        <Card title="Treasury">
          {data.treasury ? (
            <>
              <Row label="Address">
                <Addr id={data.treasury.address} full copy />
              </Row>
              <Row label="Balance">{data.treasury.balance == null ? "–" : `${sol(data.treasury.balance, 4)} ${symbol}`}</Row>
              <Row label="Share of supply">{data.treasury.balance == null ? "–" : `${share(data.treasury.balance, data.total).toFixed(2)}%`}</Row>
            </>
          ) : (
            <Empty>No treasury configured</Empty>
          )}
        </Card>
      </div>

      <Card title="Largest accounts">
        {data.largest.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Address</th>
                  <th className="text-right">Balance ({symbol})</th>
                  <th className="text-right">Share of supply</th>
                </tr>
              </thead>
              <tbody>
                {data.largest.map((row, i) => (
                  <tr key={row.address}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Addr id={row.address} full />
                        {row.address === data.treasury?.address ? <span className="chip">Treasury</span> : null}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{sol(row.lamports, 2)}</td>
                    <td className="text-right tabular-nums">{share(row.lamports, data.total).toFixed(4)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>The RPC node is still building its largest-accounts list</Empty>
        )}
      </Card>
    </>
  );
}
