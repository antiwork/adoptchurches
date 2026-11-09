import { query } from "./db";

export type EventKind = "collect" | "uncollect" | "view";

export async function recordEvent(kind: EventKind, listingId: string, sessionId: string | null) {
  await query(
    `insert into listings_demand (listing_id) values ($1) on conflict (listing_id) do nothing`,
    [listingId],
  );
  const column = kind === "view" ? "views" : "collects";
  const delta = kind === "uncollect" ? -1 : 1;
  await query(
    `update listings_demand set ${column} = greatest(0, ${column} + $2), last_event_at = now()
      where listing_id = $1`,
    [listingId, delta],
  );
  await query(`insert into events (kind, listing_id, session_id) values ($1, $2, $3)`, [
    kind,
    listingId,
    sessionId,
  ]);
}

export type DemandRow = {
  listing_id: string;
  collects: number;
  views: number;
  last_event_at: string | null;
};

export async function demandFor(listingIds: string[]): Promise<Record<string, DemandRow>> {
  if (!listingIds.length) return {};
  const rows = await query<DemandRow>(
    `select listing_id, collects, views, last_event_at
       from listings_demand where listing_id = any($1::text[])`,
    [listingIds],
  );
  return Object.fromEntries(rows.map((row) => [row.listing_id, row]));
}

export async function topDemand(limit = 25) {
  return query<{
    listing_id: string;
    collects: number;
    views: number;
    pledged_cents: string;
    last_event_at: string | null;
  }>(
    `select d.listing_id, d.collects, d.views,
            coalesce((select sum(amount_cents) from pledges p where p.listing_id = d.listing_id), 0)::text as pledged_cents,
            d.last_event_at
       from listings_demand d
      where d.collects > 0
         or exists (select 1 from pledges p where p.listing_id = d.listing_id)
      order by d.collects desc, d.last_event_at desc nulls last
      limit $1`,
    [limit],
  );
}

export async function demandSummary() {
  const [row] = await query<{
    pledges: string;
    pledged_cents: string;
    collects: string;
    listings_with_interest: string;
  }>(`select * from demand_summary`);
  return {
    pledges: Number(row?.pledges ?? 0),
    pledgedCents: Number(row?.pledged_cents ?? 0),
    collects: Number(row?.collects ?? 0),
    listingsWithInterest: Number(row?.listings_with_interest ?? 0),
  };
}
