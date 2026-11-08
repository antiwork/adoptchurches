import type { Metadata } from "next";
import Link from "next/link";
import { getListing } from "@/lib/data";
import { hasDb } from "@/lib/db";
import { demandSummary, topDemand } from "@/lib/demand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demand — adoptchurches",
  robots: { index: false, follow: false },
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  );

export default async function DemandPage() {
  if (!hasDb()) {
    return (
      <main className="checkout">
        <div className="shell">
          <h1>Demand</h1>
          <p>No database is attached. Set DATABASE_URL and run the migration.</p>
        </div>
      </main>
    );
  }

  const [summary, top] = await Promise.all([demandSummary(), topDemand(40)]);

  return (
    <main className="checkout">
      <div className="shell">
        <p className="back-line no-print">
          <Link href="/" className="back">
            Return to the atlas
          </Link>
        </p>
        <h1>What the register has drawn</h1>
        <hr className="title-rule" />
        <p className="lede">
          Counted from the database, not from a guess. Collected and basketed figures are anonymous
          counters; orders and pledges are the rows people typed their names into.
        </p>

        <dl className="order-sums demand-sums">
          <div>
            <dt>Orders entered</dt>
            <dd>{summary.orders}</dd>
          </div>
          <div>
            <dt>Value of orders</dt>
            <dd>{money(summary.orderedValueCents)}</dd>
          </div>
          <div>
            <dt>Pledges recorded</dt>
            <dd>{summary.pledges}</dd>
          </div>
          <div>
            <dt>Pledged</dt>
            <dd>{money(summary.pledgedCents)}</dd>
          </div>
          <div>
            <dt>Buildings collected</dt>
            <dd>{summary.collects}</dd>
          </div>
          <div>
            <dt>Buildings set aside in baskets</dt>
            <dd>{summary.baskets}</dd>
          </div>
          <div>
            <dt>Buildings with any interest</dt>
            <dd>{summary.listingsWithInterest}</dd>
          </div>
        </dl>

        <hr className="section-rule" />
        <h2 className="smallcaps">Buildings drawing the most attention</h2>
        {top.length === 0 ? (
          <p>Nothing yet. The atlas is open.</p>
        ) : (
          <table className="order-table demand-table">
            <thead>
              <tr>
                <th>Building</th>
                <th>Collected</th>
                <th>Baskets</th>
                <th>Pledged</th>
                <th>Last interest</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row) => {
                const listing = getListing(row.listing_id);
                return (
                  <tr key={row.listing_id}>
                    <td>
                      <div className="order-name">
                        {listing ? (
                          <Link href={`/church/${row.listing_id}`}>{listing.name}</Link>
                        ) : (
                          row.listing_id
                        )}
                      </div>
                      <div className="order-where">{listing ? `${listing.city}, ${listing.state}` : ""}</div>
                    </td>
                    <td>{row.collects}</td>
                    <td>{row.baskets}</td>
                    <td>{Number(row.pledged_cents) ? money(Number(row.pledged_cents)) : "—"}</td>
                    <td>
                      {row.last_event_at
                        ? new Date(row.last_event_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
