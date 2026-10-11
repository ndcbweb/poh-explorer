const LAMPORTS = 1_000_000_000n;

/** Base-unit string/number -> grouped decimal text with up to `max` fraction digits. */
export function units(value, decimals = 9, max = decimals) {
  if (value == null || value === "") return "–";
  let amount = BigInt(value);
  const negative = amount < 0n;
  if (negative) amount = -amount;
  const scale = 10n ** BigInt(decimals);
  const whole = (amount / scale).toLocaleString("en-US");
  const fraction = decimals ? (amount % scale).toString().padStart(decimals, "0").slice(0, max).replace(/0+$/, "") : "";
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Lamports -> coin text. */
export const sol = (lamports, max = 9) => units(lamports, 9, max);

export function solCompact(lamports) {
  if (lamports == null) return "–";
  const n = Number(BigInt(lamports) / 1000n) / 1_000_000;
  return n >= 1_000_000 ? compact(n) : n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 9 : 2 });
}

export function share(part, total) {
  const t = BigInt(total || 0);
  if (t === 0n) return 0;
  return Number((BigInt(part || 0) * 1_000_000n) / t) / 10_000;
}

export function compact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "–";
}

export function percent(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "–";
}

export function ago(seconds) {
  if (!seconds) return "–";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - seconds));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function duration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 120) return `${s}s`;
  if (s < 7200) return `${Math.round(s / 60)} min`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
  if (s < 31_536_000) return `${(s / 86400).toFixed(1)} days`;
  return `${(s / 31_536_000).toFixed(1)} years`;
}

export function date(seconds) {
  if (!seconds) return "–";
  return new Date(seconds * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });
}

export function short(hash, head = 6, tail = 6) {
  if (!hash) return "–";
  return hash.length <= head + tail + 1 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export { LAMPORTS };
