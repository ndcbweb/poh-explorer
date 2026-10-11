"use client";

import { Addr, Card, Empty, ErrorBox, Loading, PageTitle } from "@/components/ui";
import { useApi } from "@/lib/api";
import { units } from "@/lib/format";

export default function Tokens() {
  const { data, error } = useApi("/tokens", { refreshMs: 30_000 });

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <PageTitle title="Tokens" sub={`${data.tokens.length} SPL token mints (Token and Token-2022 programs)`} />
      <Card>
        {data.tokens.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mint</th>
                  <th>Program</th>
                  <th className="text-right">Supply</th>
                  <th className="text-right">Decimals</th>
                  <th>Mint authority</th>
                  <th>Freeze authority</th>
                </tr>
              </thead>
              <tbody>
                {data.tokens.map((token, i) => (
                  <tr key={token.mint}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <Addr id={token.mint} head={8} tail={8} />
                    </td>
                    <td>
                      <span className="chip">{token.program}</span>
                    </td>
                    <td className="text-right tabular-nums">{units(token.supply, token.decimals ?? 0)}</td>
                    <td className="text-right tabular-nums">{token.decimals}</td>
                    <td>{token.mintAuthority ? <Addr id={token.mintAuthority} /> : <span className="text-muted">Fixed</span>}</td>
                    <td>{token.freezeAuthority ? <Addr id={token.freezeAuthority} /> : <span className="text-muted">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No tokens have been created yet. Create one with spl-token create-token against this chain&apos;s RPC.</Empty>
        )}
      </Card>
    </>
  );
}
