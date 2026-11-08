import { getListing } from "./data";
import { db } from "./db";
import type { PledgeAggregate } from "./types";

export type OrderItemInput = { listingId: string; qty?: number };

export type OrderResult = {
  reference: string;
  name: string;
  email: string;
  town: string | null;
  note: string | null;
  items: { listingId: string; name: string; priceCents: number; priceLabel: string }[];
  subtotalCents: number;
  reserveCents: number;
  totalCents: number;
  createdAt: string;
  id: number;
};

const RESERVE_RATE = 0.04;

function reference(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const a = letters[Math.floor(Math.random() * letters.length)];
  const b = letters[Math.floor(Math.random() * letters.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getFullYear(),
  ).slice(2)}`;
  return `${a}${b} ${digits}-${stamp}`;
}

export function priceLabel(l: { priceUsd: number; priceLocal: number | null; currency: string }) {
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(l.priceUsd);
  if (l.currency && l.currency !== "USD" && l.priceLocal) {
    const local = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: l.currency,
      maximumFractionDigits: 0,
    }).format(l.priceLocal);
    return `${local} · ${usd}`;
  }
  return usd;
}

/**
 * Prices come from the register, never from the browser: a basket carries
 * listing ids and quantities only.
 */
export async function createOrder(input: {
  name: string;
  email: string;
  town: string | null;
  note: string | null;
  items: OrderItemInput[];
}): Promise<OrderResult | { error: string }> {
  const lines: OrderResult["items"] = [];
  for (const item of input.items) {
    const listing = getListing(item.listingId);
    if (!listing) return { error: `One of the buildings (${item.listingId}) isn't in the atlas.` };
    const qty = Math.max(1, Math.min(9, Math.round(item.qty ?? 1)));
    const askUsd = listing.price_usd ?? 0;
    if (!askUsd) return { error: `${listing.name} has no asking price on record.` };
    for (let i = 0; i < qty; i += 1) {
      lines.push({
        listingId: listing.id,
        name: listing.name,
        priceCents: Math.round(askUsd * 100),
        priceLabel: priceLabel({
          priceUsd: askUsd,
          priceLocal: listing.price_local ?? null,
          currency: listing.currency ?? "USD",
        }),
      });
    }
  }
  if (!lines.length) return { error: "The basket is empty." };

  const subtotalCents = lines.reduce((sum, line) => sum + line.priceCents, 0);
  const reserveCents = Math.round(subtotalCents * RESERVE_RATE);
  const totalCents = subtotalCents + reserveCents;
  const ref = reference();

  const client = await db().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string; created_at: string }>(
      `insert into orders (reference, name, email, town, note, item_count, subtotal_cents, reserve_cents, total_cents)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id::text, created_at::text`,
      [
        ref,
        input.name,
        input.email,
        input.town,
        input.note,
        lines.length,
        subtotalCents,
        reserveCents,
        totalCents,
      ],
    );
    const orderId = Number(rows[0].id);
    for (const line of lines) {
      await client.query(
        `insert into order_items (order_id, listing_id, name, price_cents, price_label)
         values ($1, $2, $3, $4, $5)`,
        [orderId, line.listingId, line.name, line.priceCents, line.priceLabel],
      );
    }
    await client.query("commit");
    return {
      id: orderId,
      reference: ref,
      name: input.name,
      email: input.email,
      town: input.town,
      note: input.note,
      items: lines,
      subtotalCents,
      reserveCents,
      totalCents,
      createdAt: rows[0].created_at,
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function markOrderEmailed(
  id: number,
  error: string | null,
  ids: { receiptId?: string; notifyId?: string } = {},
) {
  const { query } = await import("./db");
  await query(
    `update orders set emailed_at = case when $2::text is null then now() else emailed_at end,
            email_error = $2,
            receipt_email_id = coalesce($3, receipt_email_id),
            notify_email_id = coalesce($4, notify_email_id)
      where id = $1`,
    [id, error, ids.receiptId ?? null, ids.notifyId ?? null],
  );
}

export type { PledgeAggregate };
