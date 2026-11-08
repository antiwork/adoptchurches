#!/usr/bin/env node
// Harvests religious buildings for sale from Crexi's public search index and
// writes data/listings.json.
//
// Only "Special Purpose" assets are pulled (16k nationwide), then filtered down
// to actual religious buildings. The filter is deliberately conservative: a
// match inside an address ("123 Church St", "Cathedral Lane") is scrubbed first,
// so a shop on Church Street never lands on the map.
//
//   node scripts/harvest.mjs            # full nationwide refresh (~40s)
//   node scripts/harvest.mjs CA TX      # only some states
//
// Respect: this is someone else's public search endpoint. Keep the concurrency
// modest, keep the frequency low (this dataset does not change hourly), and
// leave source_url on every row so anything can be traced back.

import { writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.crexi.com/assets/search";
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const CONCURRENCY = 8;
const PAGE = 50;

const STREET_AFTER = /(church|chapel|cathedral|temple|abbey|monastery|parish)\s*(lane|ln|street|st|ave|avenue|rd|road|blvd|drive|dr|ct|court|way|pl|place|pkwy|hwy|trail|circle|cir|terrace|ter)\b\.?/gi;
const INSTITUTION = /(church|churches|chapel(?!\s*(lane|st|street|rd|road|ave|dr|way|ct|pl))|cathedral(?!\s*(lane|st|street|rd|road|ave|dr|way))|synagogue|mosque|parish|ministr(y|ies)|worship|tabernacle|diocese|abbey(?!\s*(st|street|rd|road|lane|ave))|monastery|ashram|baptist|methodist|lutheran|presbyterian|pentecostal|catholic|adventist|latter-day|gospel|evangelical|fellowship|sanctuary|congregation)/i;
const STRONG_DESC = /(sanctuary|fellowship hall|pews|seating for|congregation|worship|church building|stained glass|baptistry|auditorium seating)/i;
const JUNK = /(mobile home|rv park|rv resort|manufactured home|self storage|boat slip|marina slip)/i;
const LAND = /(^\s*0\s|vacant land|unimproved|land for sale|acres? of (vacant )?land|zoned (residential|agricultural)|(road|rd|drive|lane|ferry rd)$)/i;
const NAME_SUFFIX = /\s*[-–|]\s*(6,000\+?\s*SF.*|[\d,]+\s*±?\s*SF.*)$/i;

async function search(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://www.crexi.com",
      Referer: "https://www.crexi.com/",
      "User-Agent": "adoptachurch/0.1 (+https://github.com/antiwork/adoptachurch)",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`crexi ${res.status}`);
  return res.json();
}

const SP = { types: ["Special Purpose"], includeUnpriced: false, pageSize: PAGE };

async function countFor(state) {
  const { totalCount } = await search({ ...SP, pageSize: 5, states: [state] });
  return totalCount ?? 0;
}

async function pageFor(state, offset) {
  const { data } = await search({ ...SP, offset, states: [state] });
  return data ?? [];
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const at = i++;
        out[at] = await fn(items[at]);
      }
    }),
  );
  return out;
}

function isReligious(a) {
  const name = a.name ?? "";
  const desc = (a.description ?? "").slice(0, 1500);
  const price = a.askingPrice ?? 0;
  if (!price || price < 25_000 || a.status !== "On-Market") return false;
  if (JUNK.test(name) || JUNK.test(desc)) return false;
  const n = name.replace(STREET_AFTER, " ");
  const d = desc.replace(STREET_AFTER, " ");
  if (INSTITUTION.test(n)) return true;
  return INSTITUTION.test(d) && (d.match(STRONG_DESC) ?? []).length >= 2;
}

function toListing(a) {
  const loc = (a.locations ?? [])[0] ?? {};
  const name = (a.name ?? "").replace(NAME_SUFFIX, "").trim();
  return {
    id: `crexi-${a.id}`,
    name: name || `Church building in ${loc.city ?? "the US"}`,
    address:
      loc.fullAddress ??
      [loc.address, loc.city, loc.state?.code, loc.zip].filter(Boolean).join(", "),
    city: loc.city ?? "",
    state: loc.state?.code ?? "",
    zip: loc.zip ?? null,
    lat: Number(Number(loc.latitude).toFixed(6)),
    lng: Number(Number(loc.longitude).toFixed(6)),
    price_usd: Math.round(a.askingPrice),
    description: (a.description ?? "").replace(/\s+/g, " ").slice(0, 900),
    source: "Crexi",
    source_url: `https://www.crexi.com/properties/${a.id}/${a.urlSlug ?? ""}`,
    source_id: String(a.id),
    contact: a.brokerageName ?? null,
    images: [],
  };
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : STATES;
console.log(`counting ${wanted.length} states…`);
const counts = await mapLimit(wanted, 10, async (s) => [s, await countFor(s)]);
const total = counts.reduce((sum, [, n]) => sum + n, 0);
console.log(`${total.toLocaleString()} special-purpose buildings to scan`);

const jobs = [];
for (const [state, n] of counts) {
  for (let offset = 0; offset < Math.min(n, 1500); offset += PAGE) jobs.push([state, offset]);
}
console.log(`${jobs.length} pages…`);

let done = 0;
const pages = await mapLimit(jobs, CONCURRENCY, async ([state, offset]) => {
  const rows = await pageFor(state, offset);
  if (++done % 40 === 0) process.stdout.write(`  ${done}/${jobs.length}\n`);
  return rows;
});

const byId = new Map();
for (const row of pages.flat()) byId.set(row.id, row);
const all = [...byId.values()];
const religious = all.filter(isReligious).map(toListing);

// same address + same price = same listing
const seen = new Set();
const listings = religious
  .filter((l) => {
    const key = `${(l.address ?? "").replace(/\W+/g, "").toLowerCase().slice(0, 40)}${l.price_usd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => a.price_usd - b.price_usd || a.name.localeCompare(b.name))
  .map((l, i) => ({ ...l, rank: i + 1 }));

const out = path.join(process.cwd(), "data", "listings.json");
await writeFile(out, JSON.stringify(listings, null, 1) + "\n", "utf8");
console.log(
  `\n${listings.length} religious buildings from ${all.length.toLocaleString()} scanned → ${path.relative(process.cwd(), out)}`,
);
