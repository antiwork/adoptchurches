import type { PledgeAggregate } from "./types";
import { query } from "./db";

export type PledgeInput = {
  listingId: string;
  name: string;
  email: string;
  amountCents: number;
  note: string | null;
};

function firstInitial(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : (parts[0] ?? "Someone");
}

export async function addPledge(input: PledgeInput): Promise<{ id: string; at: string }> {
  const [row] = await query<{ id: string; created_at: string }>(
    `insert into pledges (listing_id, name, email, amount_cents, note)
     values ($1, $2, $3, $4, $5) returning id::text, created_at::text`,
    [input.listingId, input.name, input.email, input.amountCents, input.note],
  );
  return { id: row.id, at: row.created_at };
}

export async function recordPledgeMail(
  id: string,
  ids: { pledgeEmailId?: string; notifyEmailId?: string },
) {
  await query(
    `update pledges set pledge_email_id = coalesce($2, pledge_email_id),
                        notify_email_id = coalesce($3, notify_email_id)
      where id = $1`,
    [id, ids.pledgeEmailId ?? null, ids.notifyEmailId ?? null],
  );
}

export async function aggregateFor(listingId: string): Promise<PledgeAggregate> {
  const [totals] = await query<{ count: string; total_cents: string }>(
    `select count(*)::text as count, coalesce(sum(amount_cents), 0)::text as total_cents
       from pledges where listing_id = $1`,
    [listingId],
  );
  const recent = await query<{ name: string; amount_cents: string; created_at: string }>(
    `select name, amount_cents::text, created_at::text from pledges
      where listing_id = $1 order by created_at desc limit 8`,
    [listingId],
  );
  return {
    listingId,
    count: Number(totals?.count ?? 0),
    totalCents: Number(totals?.total_cents ?? 0),
    recent: recent.map((row) => ({
      name: firstInitial(row.name),
      amountCents: Number(row.amount_cents),
      at: row.created_at,
    })),
  };
}

export async function aggregateAll(): Promise<Record<string, PledgeAggregate>> {
  const rows = await query<{
    listing_id: string;
    count: string;
    total_cents: string;
  }>(
    `select listing_id, count(*)::text as count, coalesce(sum(amount_cents), 0)::text as total_cents
       from pledges group by listing_id`,
  );
  const recentRows = await query<{
    listing_id: string;
    name: string;
    amount_cents: string;
    created_at: string;
    rank: string;
  }>(
    `select listing_id, name, amount_cents::text, created_at::text, rank::text from (
        select listing_id, name, amount_cents, created_at,
               row_number() over (partition by listing_id order by created_at desc) as rank
          from pledges
     ) ranked where rank <= 8`,
  );

  const out: Record<string, PledgeAggregate> = {};
  for (const row of rows) {
    out[row.listing_id] = {
      listingId: row.listing_id,
      count: Number(row.count),
      totalCents: Number(row.total_cents),
      recent: recentRows
        .filter((r) => r.listing_id === row.listing_id)
        .map((r) => ({
          name: firstInitial(r.name),
          amountCents: Number(r.amount_cents),
          at: r.created_at,
        })),
    };
  }
  return out;
}

/** Site-wide figures for the pledge book: how much support is on the record. */
export async function bookTotals(): Promise<{ pledges: number; backers: number; totalCents: number }> {
  const [row] = await query<{ pledges: string; backers: string; total_cents: string }>(
    `select count(*)::text as pledges,
            count(distinct lower(email))::text as backers,
            coalesce(sum(amount_cents), 0)::text as total_cents
       from pledges`,
  );
  return {
    pledges: Number(row?.pledges ?? 0),
    backers: Number(row?.backers ?? 0),
    totalCents: Number(row?.total_cents ?? 0),
  };
}

export type BookRow = {
  listingId: string;
  count: number;
  totalCents: number;
  collects: number;
};

/** Buildings carrying support, most support first. Interest breaks ties. */
export async function topPledged(limit = 60): Promise<BookRow[]> {
  const rows = await query<{ listing_id: string; count: string; total_cents: string; collects: string }>(
    `select p.listing_id,
            count(*)::text as count,
            coalesce(sum(p.amount_cents), 0)::text as total_cents,
            coalesce(max(d.collects), 0)::text as collects
       from pledges p
       left join listings_demand d on d.listing_id = p.listing_id
      group by p.listing_id
      order by sum(p.amount_cents) desc, count(*) desc
      limit $1`,
    [limit],
  );
  return rows.map((r) => ({
    listingId: r.listing_id,
    count: Number(r.count),
    totalCents: Number(r.total_cents),
    collects: Number(r.collects),
  }));
}
