# Adopt a Church

An atlas of church buildings for sale in the United States, and a pledge registry so a
neighborhood can buy one back together.

**277 buildings · 41 states · $436M of asking price · median $875,000**

Every building on the map is a real, currently-listed property. Each row links back to its
source listing. Nothing here is a mockup of a listing.

## What it does

- **A map of every church for sale**, nationwide, with price bands and search by town or name.
- **“Sort by distance”** — uses the browser's location to reorder the list by how far each
  building is from you, with distances shown.
- **Per-building pages** with the listing's own description, the location, a mini map, and a
  plain-language explanation of how a group would actually buy it.
- **A pledge registry.** Anyone can attach a name, an amount, and a reason to a building. The
  page shows how many pledges there are, the total, and how far that is from the asking price.

## What a pledge is (and is not)

A pledge is an expression of interest: a name, an amount, optionally a note. No card is
collected, no money moves, and no escrow exists. When a building's pledges approach its asking
price, the group is introduced to a title company and a real-estate attorney, and money starts
moving under an entity the neighbors form themselves.

It is **not** a donation mechanism, an investment, a security, or a Reg CF offering. The site is
not a broker, does not represent sellers, and is not affiliated with any congregation,
denomination, or listing site.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript, no CSS framework — one hand-written stylesheet.
- Leaflet with CARTO/OpenStreetMap tiles (no API key, no tracking SDK).
- Listings in `data/listings.json`; every page is statically generated (291 pages).
- Pledges: `POST /api/pledges`, stored as JSON on disk for the prototype.

```
app/
  page.tsx                    hero + the atlas
  church/[id]/page.tsx        listing page + pledge panel
  api/pledges/route.ts        GET aggregates, POST a pledge
  globals.css                 the whole design system
components/
  Atlas.tsx                   map + list + search + geolocation
  PledgePanel.tsx             progress + pledge form
  MiniMap.tsx                 single-building map
data/listings.json            the dataset
scripts/
  harvest.mjs                 rebuild the dataset from public listing sources
  from-loopnet-saved-page.mjs LoopNet adapter (reads pages you save yourself)
lib/
  data.ts, pledges.ts, types.ts
```

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static generation for every listing
```

## Refreshing the data

```bash
node scripts/harvest.mjs        # nationwide refresh, ~40s
node scripts/harvest.mjs CA TX  # or just some states
```

The harvest pulls only commercial listings typed *Special Purpose*, then keeps a building when
its own listing text describes a religious building — church, chapel, cathedral, temple,
parish, ministry, sanctuary, or a denomination in the name.

Two filters are deliberate:

- **Addresses are scrubbed first.** A shop at “123 Church St” or a lot on “Cathedral Lane” never
  makes the map, because the street name is not evidence of a church.
- **Land parcels are dropped.** A listing that describes only acreage is not a building to save
  and is not shown.

### Why LoopNet is not crawled

LoopNet blocks automated requests — Akamai returns `Access Denied` to plain HTTP and to a real
browser — so `scripts/from-loopnet-saved-page.mjs` instead parses pages you save yourself and
merges them in, geocoding with the free US Census geocoder. The shipped dataset came from
Crexi's public search index, which covers the same brokers and buildings. Every listing carries
its `source` and `source_url` so the provenance is explicit.

## Deploy

`vercel` works with no configuration. Note that serverless filesystems are read-only, so the
pledge store falls back to process memory there — point `PLEDGE_DIR` at a mounted volume, or
replace `lib/pledges.ts` with a database, before inviting real pledges.

## License

MIT for the code. Listing data belongs to its sources; each row links back.
