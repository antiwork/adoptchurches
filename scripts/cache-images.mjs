// Fetch one photograph per listing, resize it, and keep the bytes in the
// database so pages never hotlink a broker's server.
//
//   node --env-file=.env.local scripts/cache-images.mjs            (all)
//   node --env-file=.env.local scripts/cache-images.mjs crexi-123  (one)
//   node --env-file=.env.local scripts/cache-images.mjs --refresh  (re-fetch what exists)
//
// Sources: Crexi's own API for the US, the listing page itself for the
// Church of England and Patrice Besse.

import { readFile, writeFile } from "node:fs/promises";
import { Client } from "pg";
import sharp from "sharp";

const LIMIT = Number(process.env.IMAGE_CONCURRENCY ?? 6);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const only = args.filter((a) => !a.startsWith("--"));

const listings = JSON.parse(await readFile(new URL("../data/listings.json", import.meta.url), "utf8"));

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("No DATABASE_URL. Run with --env-file=.env.local.");
  process.exit(1);
}
const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

async function existing() {
  const { rows } = await db.query("select listing_id from listing_images");
  return new Set(rows.map((r) => r.listing_id));
}
const have = refresh ? new Set() : await existing();

function absolute(src, base) {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

async function fetchText(target) {
  const res = await fetch(target, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-GB,en;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${target}`);
  return res.text();
}

async function fetchBytes(target) {
  const res = await fetch(target, {
    headers: {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      Referer: /patrice-besse/.test(target) ? "https://patrice-besse.com/" : "https://www.crexi.com/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${target}`);
  return Buffer.from(await res.arrayBuffer());
}

/* --------------------------------------------------------------- sources */

async function crexiPhoto(listing) {
  const res = await fetch(`https://api.crexi.com/assets/${listing.source_id}`, {
    headers: {
      Origin: "https://www.crexi.com",
      Referer: "https://www.crexi.com/",
      "User-Agent": "adoptchurches/0.1 (+https://github.com/antiwork/adoptchurches)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`crexi api ${res.status}`);
  const asset = await res.json();
  const thumb =
    asset.thumbnailUrl ??
    asset.galleryImageUrl ??
    asset.images?.[0]?.imageUrl ??
    asset.images?.[0]?.url ??
    null;
  if (!thumb) throw new Error("no thumbnail");
  // ask Crexi's image CDN for a wider crop than the card default
  const wide = thumb.replace(/width=\d+/, "width=1400").replace(/height=\d+/, "height=933");
  return { imageUrl: wide, fallbackUrl: thumb, credit: "Crexi", sourceUrl: listing.source_url };
}

function pickPhoto(html, pageUrl, { allow }) {
  const candidates = [...html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => absolute(m[1], pageUrl))
    .filter((src) => src && /\.(jpe?g|png|webp)(\?|$)/i.test(src))
    .filter((src) => allow.test(src))
    .filter((src) => !/logo|icon|sprite|placeholder|avatar|badge|banner-?cookie/i.test(src));
  if (!candidates.length) return null;
  // prefer the widest-looking file name, else the first in document order
  const scored = candidates
    .map((src) => {
      const m = src.match(/(\d{3,4})x(\d{3,4})/);
      const area = m ? Number(m[1]) * Number(m[2]) : 0;
      return { src, area };
    })
    .sort((a, b) => b.area - a.area);
  return scored[0].src;
}

/** Patrice Besse keeps one page per property; find it if we only hold a category page. */
async function besseDetailUrl(listing) {
  if (/\/annonces\//.test(listing.source_url)) return listing.source_url;
  const html = await fetchText(listing.source_url);
  const link = html.match(new RegExp(`href=["']([^"']*--${listing.source_id})["']`, "i"));
  if (link) return absolute(link[1].replace(/&amp;/g, "&"), listing.source_url);

  // Category pages list each property in its own card, keyed by the property number:
  //   <div id="716301" class="post bloc_vignette"> …photos… </div>
  const ref = listing.source_id.replace(/^pb/, "");
  const at = html.search(new RegExp(`id=["']${ref}["']`, "i"));
  if (at >= 0) {
    const rest = html.slice(at);
    const next = rest.slice(20).search(/<div[^>]+id=["']\d{5,7}["']/i);
    const card = next > 0 ? rest.slice(0, next + 20) : rest.slice(0, 9000);
    const photos = [...card.matchAll(/https:\/\/[^"'\s]*?photo-[a-z]+\/(\d+)\/(\d+x\d+)\/([^"'\s]+\.(?:jpe?g|png|webp))/gi)]
      .map((m) => {
        const dims = m[2].split("x").map(Number);
        return { url: m[0], area: dims[0] * dims[1] };
      })
      .sort((a, b) => b.area - a.area);
    if (photos.length) return photos[0].url;
  }
  throw new Error("no property page on the category listing");
}

async function heritagePhoto(listing) {
  const isBesse = /patrice-besse\.com/.test(listing.source_url);

  if (isBesse) {
    const detail = await besseDetailUrl(listing);
    if (/photo-[a-z]+\//.test(detail)) {
      return {
        imageUrl: detail.replace(/\/\d{3,4}x\d{3,4}\//, "/1200x800/"),
        fallbackUrl: detail,
        credit: "Patrice Besse",
        sourceUrl: listing.source_url,
      };
    }
    const html = await fetchText(detail);
    const og =
      html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const src = og ? absolute(og[1], detail) : null;
    if (!src || /logo/i.test(src)) throw new Error("no photograph on the property page");
    // the site serves the same photo at several sizes; ask for the wide one
    const wide = src.replace(/\/\d{3,4}x\d{3,4}\//, "/1200x800/");
    return { imageUrl: wide, fallbackUrl: src, credit: "Patrice Besse", sourceUrl: detail };
  }

  const html = await fetchText(listing.source_url);
  const imgs = [...html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)]
    .map((m) => absolute(m[1], listing.source_url))
    .filter((src) => src && /\.(jpe?g|png|webp)(\?|$)/i.test(src))
    .filter((src) => !/logo|icon|sprite|placeholder|avatar|badge/i.test(src));
  if (!imgs.length) throw new Error("no photograph on the page");
  return { imageUrl: imgs[0], credit: "Church of England", sourceUrl: listing.source_url };
}

async function photoFor(listing) {
  if (listing.source === "Crexi") return crexiPhoto(listing);
  return heritagePhoto(listing);
}

/* ----------------------------------------------------------------- store */

async function store(listing, photo) {
  let original;
  try {
    original = await fetchBytes(photo.imageUrl);
  } catch (error) {
    if (!photo.fallbackUrl) throw error;
    original = await fetchBytes(photo.fallbackUrl);
  }
  const image = sharp(original, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  if (!meta.width || meta.width < 240) throw new Error(`image too small (${meta.width}px)`);

  const hero = await sharp(original)
    .rotate()
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 74 })
    .toBuffer();
  const card = await sharp(original).rotate().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
  const blur = await sharp(original).rotate().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();

  const heroMeta = await sharp(hero).metadata();
  const { createHash } = await import("node:crypto");
  const digest = createHash("sha256").update(hero).digest("hex").slice(0, 32);

  await db.query(
    `insert into listing_images (listing_id, hero, card, blur, width, height, credit, source_url, sha256, bytes, fetched_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     on conflict (listing_id) do update set
       hero = excluded.hero, card = excluded.card, blur = excluded.blur,
       width = excluded.width, height = excluded.height, credit = excluded.credit,
       source_url = excluded.source_url, sha256 = excluded.sha256, bytes = excluded.bytes,
       fetched_at = now()`,
    [
      listing.id,
      hero,
      card,
      `data:image/webp;base64,${blur.toString("base64")}`,
      heroMeta.width,
      heroMeta.height,
      photo.credit,
      photo.sourceUrl,
      digest,
      hero.length,
    ],
  );
  return { bytes: hero.length, width: heroMeta.width };
}

/* ------------------------------------------------------------------ run */

const queue = listings.filter((l) => (only.length ? only.includes(l.id) : !have.has(l.id)));
console.log(`${queue.length} to fetch, ${have.size} already kept (concurrency ${LIMIT})`);

const results = { ok: 0, failed: [] };
let index = 0;

async function worker() {
  while (index < queue.length) {
    const listing = queue[index++];
    try {
      const photo = await photoFor(listing);
      const saved = await store(listing, photo);
      results.ok += 1;
      console.log(`ok   ${listing.id}  ${saved.width}px  ${Math.round(saved.bytes / 1024)}kb  ${photo.credit}`);
    } catch (error) {
      results.failed.push({ id: listing.id, error: error.message });
      console.log(`miss ${listing.id}  ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(LIMIT, queue.length) }, worker));
await db.end();

const { rows } = await (async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    "select count(*)::int as kept, coalesce(sum(bytes),0)::bigint as bytes from listing_images",
  );
  await c.end();
  return r;
})();

const manifest = {
  kept: rows[0].kept,
  megabytes: Number((Number(rows[0].bytes) / 1024 / 1024).toFixed(1)),
  fetchedAt: new Date().toISOString(),
  failures: results.failed,
};
await writeFile(new URL("../data/images.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nkept ${manifest.kept} photographs, ${manifest.megabytes} MB in the database`);
if (results.failed.length) console.log(`missed ${results.failed.length}`);
