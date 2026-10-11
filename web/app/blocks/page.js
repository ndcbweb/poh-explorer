"use client";

import { useState } from "react";
import { useChain } from "@/components/Shell";
import { BlocksTable } from "@/components/tables";
import { Card, ErrorBox, Loading, PageTitle, Pager } from "@/components/ui";
import { useApi } from "@/lib/api";
import { num } from "@/lib/format";

export default function Blocks() {
  const { info } = useChain();
  const [cursors, setCursors] = useState([]);
  const before = cursors.at(-1);
  const { data, error } = useApi(`/blocks?limit=25${before ? `&before=${before}` : ""}`, { refreshMs: before ? 0 : 3000 });
  const blocks = data?.blocks || [];

  return (
    <>
      <PageTitle title="Blocks" sub={data ? `Latest confirmed slot ${num(data.tip)}` : null} />
      {error && !data ? <ErrorBox message={error} /> : null}
      {!data && !error ? <Loading /> : null}
      {data ? (
        <Card>
          <BlocksTable blocks={blocks} symbol={info?.symbol || ""} />
          <Pager
            label="Skipped slots have no block and are left out"
            prevDisabled={!cursors.length}
            nextDisabled={!blocks.length || blocks.at(-1).slot === 0}
            onPrev={() => setCursors((list) => list.slice(0, -1))}
            onNext={() => setCursors((list) => [...list, blocks.at(-1).slot])}
          />
        </Card>
      ) : null}
    </>
  );
}
