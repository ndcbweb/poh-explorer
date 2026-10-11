"use client";

import Link from "next/link";
import { Addr, Empty, HashLink, Status } from "@/components/ui";
import { ago, num, sol } from "@/lib/format";

export function BlocksTable({ blocks, symbol }) {
  if (!blocks.length) return <Empty>No blocks yet</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Slot</th>
            <th>Blockhash</th>
            <th>Leader</th>
            <th className="text-right">Transactions</th>
            <th className="text-right">Votes</th>
            <th className="text-right">Fees ({symbol})</th>
            <th className="text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <tr key={block.slot}>
              <td>
                <Link href={`/block/?id=${block.slot}`} className="link font-medium tabular-nums">
                  {num(block.slot)}
                </Link>
              </td>
              <td className="mono text-muted">{block.blockhash.slice(0, 12)}…</td>
              <td>
                <Addr id={block.leader} />
              </td>
              <td className="text-right tabular-nums">{num(block.txCount - block.voteCount)}</td>
              <td className="text-right tabular-nums text-muted">{num(block.voteCount)}</td>
              <td className="text-right tabular-nums">{sol(block.fees)}</td>
              <td className="text-right text-muted">{ago(block.blockTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TxsTable({ txs, symbol, showSlot = true, empty = "No transactions yet" }) {
  if (!txs.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Signature</th>
            {showSlot ? <th>Slot</th> : null}
            <th>Signer</th>
            <th>Programs</th>
            <th>Status</th>
            <th className="text-right">Fee ({symbol})</th>
            {showSlot ? <th className="text-right">Age</th> : null}
          </tr>
        </thead>
        <tbody>
          {txs.map((tx) => (
            <tr key={tx.signature}>
              <td>
                <HashLink type="tx" id={tx.signature} head={10} tail={6} />
              </td>
              {showSlot ? (
                <td>
                  <Link href={`/block/?id=${tx.slot}`} className="link tabular-nums">
                    {num(tx.slot)}
                  </Link>
                </td>
              ) : null}
              <td>
                <Addr id={tx.signer} />
              </td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {tx.vote ? <span className="chip">Vote</span> : null}
                  {tx.programs
                    .filter((program) => program.id !== "ComputeBudget111111111111111111111111111111")
                    .slice(0, 3)
                    .map((program) => (
                      <span key={program.id} className="chip">
                        {program.name.replace(/ Program$/, "")}
                      </span>
                    ))}
                </div>
              </td>
              <td>
                <Status ok={tx.ok} />
              </td>
              <td className="text-right tabular-nums">{sol(tx.fee)}</td>
              {showSlot ? <td className="text-right text-muted">{ago(tx.blockTime)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
