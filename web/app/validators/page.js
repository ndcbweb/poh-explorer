"use client";

import { useChain } from "@/components/Shell";
import { Addr, Card, ErrorBox, Loading, PageTitle, Stat } from "@/components/ui";
import { useApi } from "@/lib/api";
import { num, percent, solCompact } from "@/lib/format";

export default function Validators() {
  const { info } = useChain();
  const symbol = info?.symbol || "";
  const { data, error } = useApi("/validators", { refreshMs: 10_000 });

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const active = data.validators.filter((v) => !v.delinquent);
  const versions = [...new Set(data.nodes.map((node) => node.version).filter(Boolean))];
  const avgCommission = active.length ? active.reduce((sum, v) => sum + v.commission, 0) / active.length : 0;

  return (
    <>
      <PageTitle title="Validators" sub={`Epoch ${num(data.epoch)} · vote accounts staked on this cluster`} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active validators" value={num(active.length)} sub={`${data.validators.length - active.length} delinquent`} accent />
        <Stat label="Active stake" value={`${solCompact(data.stake.active)} ${symbol}`} sub={`${solCompact(data.stake.delinquent)} delinquent`} />
        <Stat label="Average commission" value={`${avgCommission.toFixed(1)}%`} />
        <Stat label="Cluster nodes" value={num(data.nodes.length)} sub={versions.length ? `Agave ${versions.join(", ")}` : ""} />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Identity</th>
                <th>Vote account</th>
                <th className="text-right">Stake ({symbol})</th>
                <th className="text-right">Share</th>
                <th className="text-right">Commission</th>
                <th className="text-right">Last vote</th>
                <th className="text-right">Epoch credits</th>
                <th className="text-right">Skip rate</th>
                <th>Version</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.validators.map((v, i) => (
                <tr key={v.vote}>
                  <td className="text-muted">{i + 1}</td>
                  <td>
                    <Addr id={v.identity} />
                  </td>
                  <td>
                    <Addr id={v.vote} />
                  </td>
                  <td className="text-right tabular-nums">{solCompact(v.stake)}</td>
                  <td className="text-right tabular-nums">{v.stakeShare.toFixed(2)}%</td>
                  <td className="text-right tabular-nums">{v.commission}%</td>
                  <td className="text-right tabular-nums">{num(v.lastVote)}</td>
                  <td className="text-right tabular-nums">{num(v.epochCredits)}</td>
                  <td className="text-right tabular-nums">{v.skipRate == null ? "–" : percent(v.skipRate, 1)}</td>
                  <td className="text-muted">{v.version || "–"}</td>
                  <td>{v.delinquent ? <span className="chip-down">Delinquent</span> : <span className="chip-up">Voting</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Cluster nodes" className="mt-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Identity</th>
                <th>Role</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {data.nodes.map((node) => (
                <tr key={node.identity}>
                  <td>
                    <Addr id={node.identity} full />
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {node.voting ? <span className="chip">Validator</span> : null}
                      {node.rpc ? <span className="chip">RPC</span> : null}
                      {!node.voting && !node.rpc ? <span className="chip">Gossip</span> : null}
                    </div>
                  </td>
                  <td className="text-muted">{node.version || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
