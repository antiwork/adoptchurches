#!/usr/bin/env node
// Harvests church buildings for sale outside the US and merges them into
// data/listings.json next to the US rows from scripts/harvest.mjs.
//
// Two sources, both public and both linked on every row:
//
//   Church of England — "Closed church buildings available for disposal"
//     https://churchofengland.org/resources/parish-reorganisation-and-church-property/closed-churches/closed-church-buildings
//     Every building on that page, with the exact coordinates the page itself
//     publishes for its map markers (data-lat / data-lng), then each building's
//     own page for grade, description, guide price and the agent's link.
//
//   Patrice Besse — "édifices religieux à vendre"
//     https://patrice-besse.com/chateaux-demeures-manoirs-appartements-a-vendre/edifices-religieux-a-vendre/
//     schema.org microdata (price, currency, locality), geocoded with Nominatim.
//
//   node scripts/harvest-heritage.mjs          # both sources
//   node scripts/harvest-heritage.mjs cofe     # just the Church of England
//
// Nominatim asks for one request per second and a real User-Agent; both are
// respected below. Prices are converted to USD with a live rate, and the rate
// used is written into data/fx.json so every figure is auditable.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UA = "adoptchurches/0.1 (+https://github.com/antiwork/adoptchurches)";
const COFE_LIST =
  "https://churchofengland.org/resources/parish-reorganisation-and-church-property/closed-churches/closed-church-buildings";
const PB_LIST =
  "https://patrice-besse.com/chateaux-demeures-manoirs-appartements-a-vendre/edifices-religieux-a-vendre/";
const DATA = path.join(process.cwd(), "data");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((s) => s.replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").trim())
    .filter(Boolean);

const first = (re, s, fallback = null) => {
  const m = re.exec(s);
  return m ? m[1].trim() : fallback;
};

/* ---------------------------------- Church of England --------------------------------- */

async function churchOfEngland() {
  const html = await get(COFE_LIST);
  const chunks = html.split('data-views-row-index="').slice(1);
  const seen = new Map();
  for (const chunk of chunks) {
    const lat = first(/data-lat="(-?[\d.]+)"/, chunk);
    const lng = first(/data-lng="(-?[\d.]+)"/, chunk);
    const slug = first(/href="(\/closed-churches\/[^"]+)"/, chunk);
    if (!lat || !lng || !slug || seen.has(slug)) continue;
    seen.set(slug, { slug, lat: Number(lat), lng: Number(lng) });
  }
  console.log(`CofE: ${seen.size} buildings listed for disposal`);

  const out = [];
  for (const { slug, lat, lng } of seen.values()) {
    const url = `https://churchofengland.org${slug}`;
    let page = "";
    try {
      page = await get(url);
      await sleep(400);
    } catch (e) {
      console.log(`  skip ${slug} (${e.message})`);
      continue;
    }
    const lines = text(page);
    const rawName = first(/<title>([^<|]+)/, page) ?? slug.split("/").pop();
    const name = rawName.replace(/\s*\|.*$/, "").trim();
    const grade = lines.find((l) => /^(Grade I|Grade II\*?|Unlisted)$/.test(l)) ?? "";
    const i = lines.indexOf("About this property");
    const about = i >= 0 ? lines.slice(i + 1, i + 9).join(" ").slice(0, 1200) : "";
    const prices = [...page.matchAll(/£\s?([\d,]{4,9})/g)].map((m) => Number(m[1].replace(/,/g, "")));
    const price = prices.length ? Math.max(...prices) : null;
    const agent = first(/href="(https?:\/\/[^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*?Full listing/, page);
    // "Altrincham, St John (Diocese of Chester)" → town "Altrincham"
    // "South Moor St George (Diocese of Durham)" → town "South Moor"
    const bare = name.replace(/\s*\(Diocese of[^)]*\)/, "").trim();
    const town = bare.includes(",")
      ? bare.split(",")[0].trim()
      : bare.split(/\s+(?:St\.?|Saint|Holy|All Saints|Christ|Emmanuel|Trinity|Good Shepherd)\s/)[0].trim();
    const county = first(/Diocese of\s*([A-Za-z ()]+)\)/, name) ?? "";
    out.push({
      id: `cofe-${slug.replace("/closed-churches/", "")}`,
      name: bare,
      address: [bare, county ? `Diocese of ${county}` : null, "England"].filter(Boolean).join(", "),
      city: town || county,
      region: county ? `Diocese of ${county}` : "England",
      country: "GB",
      lat,
      lng,
      price_local: price,
      currency: "GBP",
      description: about || `${grade || "Listed"} church building offered for disposal by the Church of England.`,
      grade: grade || null,
      status: "Available",
      source: "Church of England",
      source_url: url,
      source_id: slug,
      contact_url: agent,
    });
  }
  return out;
}

/* ------------------------------------ Patrice Besse ----------------------------------- */

async function nominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const rows = await res.json();
  const hit = Array.isArray(rows) ? rows[0] : null;
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

async function patriceBesse() {
  const html = await get(PB_LIST);
  const blocks = html.split('itemtype="http://schema.org/Product http://schema.org/House"').slice(1);
  console.log(`Patrice Besse: ${blocks.length} religious edifices listed`);

  const out = [];
  for (const b of blocks) {
    const ref = first(/itemprop="productID" content="(\d+)"/, b);
    const name = first(/itemprop="name">\s*<a[^>]*>([^<]+)<\/a>/, b);
    const href = first(/<a href="(\/annonces\/[^"]+)"/, b);
    const price = first(/itemprop="price" content="(\d+)"/, b);
    const currency = first(/itemprop="priceCurrency" content="([A-Z]{3})"/, b);
    const city = first(/itemprop="addressLocality" content="([^"]*)"/, b) ?? "";
    const dept = first(/itemprop="addressRegion" content="([^"]*)"/, b) ?? "";
    const country = first(/itemprop="addressCountry" content="([A-Z]{2})"/, b) ?? "FR";
    if (!ref || !name) continue;

    const clean = city.split(",")[0].trim();
    let coords = await nominatim([clean, dept, country].filter(Boolean).join(", "));
    await sleep(1200);
    if (!coords) {
      coords = await nominatim([dept, country].filter(Boolean).join(", "));
      await sleep(1200);
    }
    if (!coords) {
      console.log(`  skip (no geocode): ${name.slice(0, 50)}`);
      continue;
    }
    out.push({
      id: `pb-${ref}`,
      name: name.replace(/\s+/g, " ").trim(),
      address: [city, dept, country === "FR" ? "France" : country].filter(Boolean).join(", "),
      city: city.replace(/,.*$/, "").trim(),
      region: dept,
      country,
      lat: coords.lat,
      lng: coords.lng,
      price_local: price ? Number(price) : null,
      currency: currency ?? "EUR",
      description: name,
      grade: null,
      status: "Available",
      source: "Patrice Besse",
      source_url: href ? `https://patrice-besse.com${href}` : PB_LIST,
      source_id: `pb${ref}`,
      contact_url: href ? `https://patrice-besse.com${href}` : null,
    });
  }
  return out;
}

/* ---------------------------------------- merge -------------------------------------- */

async function fxRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { headers: { "User-Agent": UA } });
    const json = await res.json();
    const asOf = json.time_last_update_utc?.slice(5, 16) ?? new Date().toISOString().slice(0, 10);
    return { usdPer: { USD: 1, GBP: 1 / json.rates.GBP, EUR: 1 / json.rates.EUR }, asOf };
  } catch {
    console.log("fx: falling back to 1 GBP = 1.34 USD, 1 EUR = 1.12 USD");
    return { usdPer: { USD: 1, GBP: 1.34, EUR: 1.12 }, asOf: "fallback" };
  }
}

const only = process.argv[2];
const fx = await fxRates();
await writeFile(path.join(DATA, "fx.json"), JSON.stringify(fx, null, 1) + "\n", "utf8");
console.log(`fx as of ${fx.asOf}: £1 = $${fx.usdPer.GBP.toFixed(3)}, €1 = $${fx.usdPer.EUR.toFixed(3)}`);

const existing = JSON.parse(await readFile(path.join(DATA, "listings.json"), "utf8").catch(() => "[]"));

// keep rows from sources we are not re-harvesting this run, and normalise them
const harvestingGB = only !== "pb";
const harvestingFR = only !== "cofe";
const keep = existing.filter((l) => {
  const c = l.country ?? "US";
  if (c === "US") return false; // normalised below instead
  if (c === "GB") return !harvestingGB;
  if (c === "FR") return !harvestingFR;
  return true;
});

const us = existing
  .filter((l) => (l.country ?? "US") === "US" && !/^(pb-|cofe-)/.test(l.id))
  .map((l) => ({
    ...l,
    country: "US",
    currency: "USD",
    price_local: l.price_local ?? l.price_usd,
    region: l.region ?? l.state,
    status: l.status ?? "Available",
    contact_url: l.contact_url ?? null,
  }));

const fresh = [];
if (only !== "pb") fresh.push(...(await churchOfEngland()));
if (only !== "cofe") fresh.push(...(await patriceBesse()));

const priced = (row) => (row.price_local ? Math.round(row.price_local * (fx.usdPer[row.currency] ?? 1)) : null);
const rows = [...us, ...keep, ...fresh.map((r) => ({ ...r, price_usd: priced(r) }))];

const merged = rows
  .sort((a, b) => (a.price_usd ?? 1e12) - (b.price_usd ?? 1e12) || a.name.localeCompare(b.name))
  .map((r, i) => ({ ...r, rank: i + 1 }));

await writeFile(path.join(DATA, "listings.json"), JSON.stringify(merged, null, 1) + "\n", "utf8");
const byCountry = {};
for (const r of merged) byCountry[r.country] = (byCountry[r.country] ?? 0) + 1;
console.log(`wrote ${merged.length} listings → ${JSON.stringify(byCountry)}`);
