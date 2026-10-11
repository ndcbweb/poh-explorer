"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, useApi } from "@/lib/api";

const InfoContext = createContext({ info: null, error: "" });

export function useChain() {
  return useContext(InfoContext);
}

const NAV = [
  { href: "/", label: "Home" },
  { href: "/blocks/", label: "Blocks" },
  { href: "/txs/", label: "Transactions" },
  { href: "/validators/", label: "Validators" },
  { href: "/tokens/", label: "Tokens" },
  { href: "/supply/", label: "Supply" },
  { href: "/network/", label: "Network" },
];

const THEME_KEY = "explorer-theme";

function ThemeToggle({ preferred }) {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      /* private mode */
    }
    if (!stored && preferred && preferred !== "system") document.documentElement.classList.toggle("dark", preferred === "dark");
    setDark(document.documentElement.classList.contains("dark"));
  }, [preferred]);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      /* private mode */
    }
  };
  return (
    <button type="button" onClick={toggle} className="btn-ghost h-9 w-9 !p-0" aria-label="Toggle theme">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export function SearchBar({ large = false }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const hit = await api(`/search?q=${encodeURIComponent(value)}`);
      setQuery("");
      router.push(`/${hit.type}/?id=${encodeURIComponent(hit.id)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 focus-within:border-brand dark:border-white/10 dark:bg-field ${
          large ? "h-12" : "h-10"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
          placeholder="Search by address, transaction signature, token or slot"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted"
          spellCheck={false}
        />
        {busy ? <span className="text-xs text-muted">Searching…</span> : null}
      </div>
      {error ? <p className="absolute left-1 top-full mt-1 text-xs text-down">{error}</p> : null}
    </form>
  );
}

function Logo({ info }) {
  const branding = info?.branding || {};
  const name = info?.chainName || "Explorer";
  if (branding.logoUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={branding.logoUrl} alt={name} className="h-8 w-auto max-w-[160px] object-contain" />
        {branding.hideNameWithLogo ? null : <span className="hidden text-[15px] font-semibold sm:block">{name}</span>}
      </>
    );
  }
  return (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-mint text-sm font-bold text-white">
        {(info?.symbol || name).slice(0, 1)}
      </span>
      <span className="hidden text-[15px] font-semibold sm:block">{name}</span>
    </>
  );
}

const SOCIAL = ["website", "twitter", "telegram", "discord", "github"];

export default function Shell({ children }) {
  const pathname = usePathname();
  const { data: info, error } = useApi("/info", { refreshMs: 30_000 });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const branding = info?.branding || {};
  useEffect(() => {
    if (!info) return;
    document.title = branding.metaTitle || `${info.chainName} Explorer`;
    if (branding.brandColor) document.documentElement.style.setProperty("--brand", branding.brandColor);
    if (branding.faviconUrl) {
      let link = document.querySelector("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.faviconUrl;
    }
  }, [info, branding.metaTitle, branding.brandColor, branding.faviconUrl]);

  const active = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    <InfoContext.Provider value={{ info, error }}>
      {branding.announcementEnabled && branding.announcementText ? (
        <div className="bg-brand px-4 py-2 text-center text-xs font-medium text-white">
          {branding.announcementLink ? (
            <a href={branding.announcementLink} target="_blank" rel="noreferrer" className="underline">
              {branding.announcementText}
            </a>
          ) : (
            branding.announcementText
          )}
        </div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur dark:border-white/5 dark:bg-night/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Logo info={info} />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active(item.href) ? "text-ink dark:text-white" : "text-muted hover:text-ink dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {pathname !== "/" ? (
              <div className="hidden w-80 md:block">
                <SearchBar />
              </div>
            ) : null}
            <ThemeToggle preferred={branding.defaultTheme} />
            <button type="button" className="btn-ghost h-9 w-9 !p-0 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
        {open ? (
          <nav className="border-t border-black/5 px-4 py-2 lg:hidden dark:border-white/5">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm font-medium">
                {item.label}
              </Link>
            ))}
            {pathname !== "/" ? (
              <div className="py-2">
                <SearchBar />
              </div>
            ) : null}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t border-black/5 py-8 text-xs text-muted dark:border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 text-center">
          {branding.footerAbout ? <p className="max-w-2xl">{branding.footerAbout}</p> : null}
          <div className="flex flex-wrap justify-center gap-4">
            {SOCIAL.filter((key) => branding[key]).map((key) => (
              <a key={key} href={branding[key]} target="_blank" rel="noreferrer" className="capitalize hover:text-brand">
                {key}
              </a>
            ))}
            {branding.email ? (
              <a href={`mailto:${branding.email}`} className="hover:text-brand">
                {branding.email}
              </a>
            ) : null}
          </div>
          <p>{branding.copyright || `${info?.chainName || "Chain"} explorer · Powered by Nadcab`}</p>
        </div>
      </footer>
    </InfoContext.Provider>
  );
}
