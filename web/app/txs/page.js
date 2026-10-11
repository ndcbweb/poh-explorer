"use client";

import { useState } from "react";
import { useChain } from "@/components/Shell";
import { TxsTable } from "@/components/tables";
import { Card, ErrorBox, Loading, PageTitle, Pager } from "@/components/ui";
import { useApi } from "@/lib/api";

export default function Transactions() {
  const { info } = useChain();
  const [cursors, setCursors] = useState([]);
  const before = cursors.at(-1);
  const { data, error } = useApi(`/txs?limit=25${before ? `&before=${before}` : ""}`, { refreshMs: before ? 0 : 5000 });

  return (
    <>
      <PageTitle title="Transactions" sub="User transactions, newest first. Validator vote transactions are hidden." />
      {error && !data ? <ErrorBox message={error} /> : null}
      {!data && !error ? <Loading /> : null}
      {data ? (
        <Card>
          <TxsTable txs={data.txs} symbol={info?.symbol || ""} empty="No user transactions in the last 400 slots" />
          <Pager
            prevDisabled={!cursors.length}
            nextDisabled={!data.nextBefore}
            onPrev={() => setCursors((list) => list.slice(0, -1))}
            onNext={() => setCursors((list) => [...list, data.nextBefore])}
          />
        </Card>
      ) : null}
    </>
  );
}
