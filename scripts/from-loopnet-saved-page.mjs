#!/usr/bin/env node
// LoopNet adapter.
//
// LoopNet blocks automated requests (Akamai returns "Access Denied" to both curl
// and a real browser), so this does not crawl it. Instead it reads pages you
// save yourself, and merges whatever it finds into data/listings.json:
//
//   1. Open a LoopNet search in a browser you control, e.g.
//      https://www.loopnet.com/search/churches/usa/for-sale/
//   2. Save the page (Cmd+S → "Web Page, Complete") into ./loopnet-pages/
//   3. node scripts/from-loopnet-saved-page.mjs
//
// It parses the embedded JSON (`__NEXT_DATA__`, `application/ld+json`) for
// address, city/state/zip, and price, then geocodes with the US Census geocoder
// (free, no key). LoopNet rarely exposes coordinates in the saved HTML, so
// without a geocode hit the row is skipped rather than pinned in the wrong place.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGES_DIR = path.join(process.cwd(), "loopnet-pages");
const OUT = path.join(process.cwd(), "data", "listings.json");
const CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

function blocks(html) {
  const out = [];
  for (const re of [
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/g,
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  ]) {
    for (const m of html.matchAll(re)) {
      try {
        out.push(JSON.parse(m[1]));
      } catch {
        /* ignore malformed blocks */
      }
    }
  }
  return out;
}

// Walk arbitrary JSON looking for objects that look like a listing.
function harvest(node, found = []) {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    for (const item of node) harvest(item, found);
    return found;
  }
  const addr = node.address ?? node.Address ?? node.streetAddress;
  const city = node.city ?? node.City ?? node.addressLocality;
  const state = node.state ?? node.State ?? node.addressRegion;
  const price = node.price ?? node.Price ?? node.askingPrice ?? node.priceValue;
  const name = node.name ?? node.Name ?? node.title ?? node.headline;
  if (name && (price || node.priceValue) && (addr || city)) {
    found.push({
      name: String(name).trim(),
      address: typeof addr === "string" ? addr.trim() : "",
      city: typeof city === "string" ? city.trim() : "",
      state: typeof state === "string" ? state.trim().slice(0, 2).toUpperCase() : "",
      price: Number(String(price).replace(/[^\d.]/g, "")),
      url: node.url ?? null,
      description: String(node.description ?? "").replace(/\s+/g, " ").slice(0, 900),
    });
  }
  for (const v of Object.values(node)) harvest(v, found);
  return found;
}

async function geocode(address, city, state) {
  const oneLine = [address, city, state].filter(Boolean).join(", ");
  const url = `${CENSUS}?address=${encodeURIComponent(oneLine)}&benchmark=Public_AR_Current&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const match = json?.result?.addressMatches?.[0];
  if (!match) return null;
  return { lat: match.coordinates.y, lng: match.coordinates.x, matched: match.matchedAddress };
}

const files = (await readdir(PAGES_DIR).catch(() => [])).filter((f) => f.endsWith(".html"));
if (!files.length) {
  console.log(`Save a LoopNet page into ${PAGES_DIR}/ first (see the comment at the top).`);
  process.exit(1);
}

const raw = new Map();
for (const file of files) {
  const html = await readFile(path.join(PAGES_DIR, file), "utf8");
  for (const block of blocks(html)) {
    for (const row of harvest(block)) {
      if (!row.price || row.price < 25_000) continue;
      raw.set(`${row.address}|${row.city}|${row.price}`, row);
    }
  }
}
console.log(`parsed ${raw.size} candidate rows from ${files.length} saved page(s)`);

const existing = JSON.parse(await readFile(OUT, "utf8").catch(() => "[]"));
const haveSource = new Set(existing.map((l) => l.source_id));

const added = [];
for (const row of raw.values()) {
  const key = `loopnet-${Buffer.from(`${row.address}|${row.city}|${row.state}`).toString("base64url").slice(0, 16)}`;
  if (haveSource.has(key)) continue;
  const geo = await geocode(row.address, row.city, row.state);
  if (!geo) {
    console.log(`  skip (no geocode): ${row.address}, ${row.city} ${row.state}`);
    continue;
  }
  added.push({
    id: key,
    name: row.name,
    address: [row.address, row.city, row.state].filter(Boolean).join(", "),
    city: row.city,
    state: row.state,
    zip: null,
    lat: Number(geo.lat.toFixed(6)),
    lng: Number(geo.lng.toFixed(6)),
    price_usd: Math.round(row.price),
    description: row.description,
    source: "LoopNet",
    source_url: row.url ?? "https://www.loopnet.com/search/churches/usa/for-sale/",
    source_id: key,
    contact: null,
    images: [],
  });
  await new Promise((r) => setTimeout(r, 1100)); // Census geocoder courtesy limit
}

const merged = [...existing, ...added]
  .sort((a, b) => a.price_usd - b.price_usd || a.name.localeCompare(b.name))
  .map((l, i) => ({ ...l, rank: i + 1 }));

await writeFile(OUT, JSON.stringify(merged, null, 1) + "\n", "utf8");
console.log(`added ${added.length} LoopNet listings → ${merged.length} total in data/listings.json`);
