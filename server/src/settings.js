import fs from "node:fs";
import path from "node:path";
import { ENV } from "./config.js";

/**
 * Branding managed from Nadcab Console ("Manage explorer"). The console writes branding/settings.json plus
 * logo and favicon files into DATA_DIR; the same schema as github.com/ndcbweb/basic-explorer.
 */

export const BRANDING_DIR = path.join(ENV.dataDir, "branding");
const SETTINGS_FILE = path.join(BRANDING_DIR, "settings.json");

const HEX = /^#[0-9a-f]{6}$/i;
const ASSET = /^(logo|favicon)\.(png|jpg|jpeg|svg|webp|ico|gif)$/;

const text = (value, max = 200) => (typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "");
const url = (value) => {
  const raw = text(value, 300);
  return /^https?:\/\/[^\s"'<>]+$/i.test(raw) ? raw : "";
};

function sanitize(raw = {}) {
  const price = Number(raw.coinPriceUsd);
  return {
    chainName: text(raw.chainName, 60),
    heroTitle: text(raw.heroTitle, 120),
    heroSubtitle: text(raw.heroSubtitle, 160),
    hideNameWithLogo: raw.hideNameWithLogo === true,
    logo: ASSET.test(raw.logo || "") ? raw.logo : "",
    favicon: ASSET.test(raw.favicon || "") ? raw.favicon : "",
    version: text(String(raw.version ?? ""), 40),
    brandColor: HEX.test(raw.brandColor || "") ? raw.brandColor : "",
    heroColor: HEX.test(raw.heroColor || "") ? raw.heroColor : "",
    defaultTheme: ["light", "dark"].includes(raw.defaultTheme) ? raw.defaultTheme : "system",
    currencySymbol: text(raw.currencySymbol, 12),
    currencyName: text(raw.currencyName, 40),
    coinPriceUsd: Number.isFinite(price) && price > 0 ? price : null,
    website: url(raw.website),
    twitter: url(raw.twitter),
    telegram: url(raw.telegram),
    discord: url(raw.discord),
    github: url(raw.github),
    email: /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(raw.email || "") ? raw.email : "",
    footerAbout: text(raw.footerAbout, 400),
    copyright: text(raw.copyright, 120),
    metaTitle: text(raw.metaTitle, 80),
    metaDescription: text(raw.metaDescription, 300),
    announcementEnabled: raw.announcementEnabled === true,
    announcementText: text(raw.announcementText, 200),
    announcementLink: url(raw.announcementLink),
  };
}

let cache = { mtime: -1, value: sanitize() };

export function getSettings() {
  let mtime = 0;
  try {
    mtime = fs.statSync(SETTINGS_FILE).mtimeMs;
  } catch {
    mtime = 0;
  }
  if (mtime === cache.mtime) return cache.value;
  let raw = {};
  if (mtime) {
    try {
      raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    } catch {
      raw = {};
    }
  }
  cache = { mtime, value: sanitize(raw) };
  return cache.value;
}

export function assetUrl(settings, kind) {
  const file = settings[kind];
  return file ? `/branding/${file}?v=${encodeURIComponent(settings.version || "1")}` : "";
}
