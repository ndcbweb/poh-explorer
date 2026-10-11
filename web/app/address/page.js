"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useChain } from "@/components/Shell";
import { Addr, Card, Copy, Empty, ErrorBox, HashLink, Loading, PageTitle, Pager, Row, Status, Tabs } from "@/components/ui";
import { useApi } from "@/lib/api";
import { ago, num, percent, sol, units } from "@/lib/format";

function MintDetails({ account }) {
  const mint = account.mint;
  return (
    <>
      <Row label="Supply">{units(mint.supply, mint.decimals)}</Row>
      <Row label="Decimals">{mint.decimals}</Row>
      <Row label="Holders">{mint.holders == null ? "–" : num(mint.holders)}</Row>
      <Row label="Mint authority">{mint.mintAuthority ? <Addr id={mint.mintAuthority} full /> : <span className="text-muted">None (fixed supply)</span>}</Row>
      <Row label="Freeze authority">{mint.freezeAuthority ? <Addr id={mint.freezeAuthority} full /> : <span className="text-muted">None</span>}</Row>
      {mint.extensions.length ? (
        <Row label="Extensions">
          <div className="flex flex-wrap gap-1">
            {mint.extensions.map((ext) => (
              <span key={ext} className="chip">
                {ext}
              </span>
            ))}
          </div>
        </Row>
      ) : null}
    </>
  );
}

function AccountDetails({ account, symbol }) {
  if (account.kind === "tokenAccount") {
    const token = account.token;
    return (
      <>
        <Row label="Token balance">{token.ui}</Row>
        <Row label="Mint">
          <Addr id={token.mint} full />
        </Row>
        <Row label="Owner">
          <Addr id={token.owner} full />
        </Row>
        <Row label="State">
          <span className="chip capitalize">{token.state}</span>
        </Row>
        {token.delegate ? (
          <Row label="Delegate">
            <Addr id={token.delegate} full />
          </Row>
        ) : null}
      </>
    );
  }
  if (account.kind === "mint") return <MintDetails account={account} />;
  if (account.kind === "vote") {
    const vote = account.vote;
    return (
      <>
        <Row label="Validator identity">
          <Addr id={vote.node} full />
        </Row>
        <Row label="Commission">{vote.commission}%</Row>
        <Row label="Last vote">{vote.lastVote == null ? "–" : num(vote.lastVote)}</Row>
        <Row label="Root slot">{vote.rootSlot == null ? "–" : num(vote.rootSlot)}</Row>
        <Row label="Authorized voter">
          {vote.voters.map((voter) => (
            <div key={voter}>
              <Addr id={voter} full />
            </div>
          ))}
        </Row>
        <Row label="Withdraw authority">
          <Addr id={vote.withdrawer} full />
        </Row>
        <Row label="Credits by epoch">
          <div className="flex flex-wrap gap-1">
            {vote.epochCredits.map((row) => (
              <span key={row.epoch} className="chip">
                Epoch {row.epoch}: {num(row.credits)}
              </span>
            ))}
          </div>
        </Row>
      </>
    );
  }
  if (account.kind === "stake") {
    const stake = account.stake;
    const deactivating = stake.deactivationEpoch && stake.deactivationEpoch !== "18446744073709551615";
    return (
      <>
        <Row label="State">
          <span className="chip capitalize">{stake.state}</span>
          {deactivating ? <span className="chip ml-1">Deactivating at epoch {stake.deactivationEpoch}</span> : null}
        </Row>
        <Row label="Delegated stake">
          {stake.delegated ? `${sol(stake.delegated)} ${symbol}` : "–"}
        </Row>
        <Row label="Delegated to (vote account)">{stake.voter ? <Addr id={stake.voter} full /> : "–"}</Row>
        <Row label="Activation epoch">{stake.activationEpoch ?? "–"}</Row>
        <Row label="Stake authority">
          <Addr id={stake.staker} full />
        </Row>
        <Row label="Withdraw authority">
          <Addr id={stake.withdrawer} full />
        </Row>
        <Row label="Rent-exempt reserve">
          {stake.rentExemptReserve ? `${sol(stake.rentExemptReserve)} ${symbol}` : "–"}
        </Row>
      </>
    );
  }
  if (account.kind === "program" && account.upgrade) {
    return (
      <>
        <Row label="Program data account">
          <Addr id={account.upgrade.programData} full />
        </Row>
        <Row label="Upgrade authority">{account.upgrade.authority ? <Addr id={account.upgrade.authority} full /> : <span className="text-muted">None (immutable)</span>}</Row>
        <Row label="Last deployed slot">
          {account.upgrade.slot != null ? (
            <Link className="link" href={`/block/?id=${account.upgrade.slot}`}>
              {num(account.upgrade.slot)}
            </Link>
          ) : (
            "–"
          )}
        </Row>
      </>
    );
  }
  return null;
}

function History({ data, cursors, setCursors }) {
  if (!data.history.length) return <Empty>No transactions for this address</Empty>;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Signature</th>
              <th>Slot</th>
              <th>Status</th>
              <th>Memo</th>
              <th className="text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((row) => (
              <tr key={row.signature}>
                <td>
                  <HashLink type="tx" id={row.signature} head={12} tail={8} />
                </td>
                <td>
                  <Link className="link tabular-nums" href={`/block/?id=${row.slot}`}>
                    {num(row.slot)}
                  </Link>
                </td>
                <td>
                  <Status ok={row.ok} />
                </td>
                <td className="max-w-[240px] truncate text-muted">{row.memo || "–"}</td>
                <td className="text-right text-muted">{ago(row.blockTime)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        prevDisabled={!cursors.length}
        nextDisabled={!data.nextBefore}
        onPrev={() => setCursors((list) => list.slice(0, -1))}
        onNext={() => setCursors((list) => [...list, data.nextBefore])}
      />
    </>
  );
}

function Tokens({ tokens }) {
  if (!tokens.length) return <Empty>This address holds no tokens</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Mint</th>
            <th>Token account</th>
            <th>Program</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.account}>
              <td>
                <Addr id={token.mint} head={8} tail={8} />
              </td>
              <td>
                <Addr id={token.account} />
              </td>
              <td>
                <span className="chip">{token.program.startsWith("Tokenz") ? "Token-2022" : "Token"}</span>
              </td>
              <td className="text-right tabular-nums">{units(token.amount, token.decimals)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Holders({ account, supply }) {
  if (!account.largest?.length) return <Empty>No holders yet</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Owner</th>
            <th>Token account</th>
            <th className="text-right">Balance</th>
            <th className="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {account.largest.map((row, i) => (
            <tr key={row.account}>
              <td className="text-muted">{i + 1}</td>
              <td>
                <Addr id={row.owner} head={8} tail={8} />
              </td>
              <td>
                <Addr id={row.account} />
              </td>
              <td className="text-right tabular-nums">{row.ui}</td>
              <td className="text-right tabular-nums">{BigInt(supply) > 0n ? percent(Number((BigInt(row.amount) * 1_000_000n) / BigInt(supply)) / 1_000_000) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddressView() {
  const id = useSearchParams().get("id") || "";
  const { info } = useChain();
  const [cursors, setCursors] = useState([]);
  const [tab, setTab] = useState("history");
  useEffect(() => {
    setCursors([]);
    setTab("history");
  }, [id]);
  const before = cursors.at(-1);
  const { data, error, loading } = useApi(id ? `/address/${encodeURIComponent(id)}?limit=25${before ? `&before=${before}` : ""}` : null);
  const symbol = info?.symbol || "";

  if (!id) return <ErrorBox message="No address selected" />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} />;
  const account = data.account;
  const isTreasury = info?.rules?.treasury === id;
  const tabs = [{ id: "history", label: "Transactions" }];
  if (account.kind === "mint") tabs.push({ id: "holders", label: "Top holders" });
  if (data.tokens.length || account.kind === "wallet") tabs.push({ id: "tokens", label: `Tokens (${data.tokens.length})` });

  return (
    <>
      <PageTitle
        title={
          <span className="flex flex-wrap items-center gap-2">
            {account.label}
            {isTreasury ? <span className="chip">Treasury</span> : null}
          </span>
        }
        sub={
          <>
            <span className="mono truncate">{data.address}</span>
            <Copy text={data.address} />
          </>
        }
      />

      <Card className="mb-6">
        <Row label="Address">
          <span className="mono">{data.address}</span>
        </Row>
        <Row label="Balance">
          <span className="font-semibold">
            {account.kind === "unfunded" ? "0" : sol(account.lamports)} {symbol}
          </span>
        </Row>
        {account.kind !== "unfunded" ? (
          <>
            <Row label="Owner program">
              <Addr id={account.owner} name={account.ownerName || undefined} full />
            </Row>
            <Row label="Executable">{account.executable ? "Yes" : "No"}</Row>
            <Row label="Data size">{account.space == null ? "–" : `${num(account.space)} bytes`}</Row>
          </>
        ) : (
          <Row label="State">
            <span className="text-muted">This address has never been funded or its account was closed.</span>
          </Row>
        )}
        <AccountDetails account={account} symbol={symbol} />
      </Card>

      <Card title={<Tabs tabs={tabs} value={tab} onChange={setTab} />}>
        {tab === "history" ? <History data={data} cursors={cursors} setCursors={setCursors} /> : null}
        {tab === "tokens" ? <Tokens tokens={data.tokens} /> : null}
        {tab === "holders" ? <Holders account={account} supply={account.mint.supply} /> : null}
      </Card>
    </>
  );
}

export default function AddressPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AddressView />
    </Suspense>
  );
}
