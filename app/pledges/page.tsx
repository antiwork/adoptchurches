import type { Metadata } from "next";
import Link from "next/link";
import { displayName, getListing, whereLabel, priceLabel, money } from "@/lib/data";
import { hasDb } from "@/lib/db";
import { bookTotals, topPledged } from "@/lib/pledges-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The pledge book · adoptchurches",
  description:
    "Every name and amount put behind a church building, in the open. A pledge is a promise of support, not a payment.",
};

export default async function PledgeBook() {
  if (!hasDb()) {
    return (
      <main className="shell doc">
        <h1>The pledge book</h1>
        <p>No database is attached, so the book cannot be opened.</p>
      </main>
    );
  }

  const [totals, rows] = await Promise.all([bookTotals(), topPledged(60)]);

  return (
    <main className="shell doc pledge-book">
      <div className="eyebrow">The pledge book</div>
      <h1>What people have put behind them</h1>
      <hr className="title-rule" />

      <p className="lede">
        Every pledge is a name, an amount, and sometimes a reason. Nothing here is a payment: no
        card is taken, no money moves, and no one is bound. It is kept in the open so that a person
        who means to save a building can see they are not the first.
      </p>

      <dl className="book-totals">
        <div>
          <dt>Pledged</dt>
          <dd>{money(totals.totalCents)}</dd>
        </div>
        <div>
          <dt>Pledges</dt>
          <dd>{totals.pledges}</dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>{totals.backers}</dd>
        </div>
      </dl>

      <hr className="section-rule" />

      {rows.length === 0 ? (
        <div className="book-empty">
          <p>
            <strong>The book opens with the first name.</strong> Choose a building from the atlas,
            read what is known about it, and if you would put something behind it, enter a pledge on
            its page. It costs nothing to be counted.
          </p>
          <p className="book-cta">
            <Link href="/" className="support-link wide">
              To the atlas
            </Link>
          </p>
        </div>
      ) : (
        <ul className="book-list">
          {rows.map((row) => {
            const l = getListing(row.listingId);
            if (!l) return null;
            const goal = (l.price_usd ?? 0) * 100;
            const pct = goal > 0 ? Math.min(100, Math.round((row.totalCents / goal) * 100)) : 0;
            return (
              <li key={row.listingId} className="book-row">
                <div className="book-main">
                  <Link href={`/church/${l.id}`} className="book-name">
                    {displayName(l)}
                  </Link>
                  <div className="book-where">{whereLabel(l)}</div>
                </div>
                <div className="book-figure">
                  <div className="book-amount">{money(row.totalCents)}</div>
                  <div className="book-meta">
                    {row.count} {row.count === 1 ? "pledge" : "pledges"}
                    {goal > 0 ? ` · ${pct}% of ${priceLabel(l)}` : ""}
                  </div>
                </div>
                <div className="book-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
                <Link href={`/church/${l.id}#support`} className="book-add">
                  Add your name
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="book-fine">
        A pledge is not a donation, an investment, or an offer of securities. When the support
        against a building approaches the figure asked, the people in the book are introduced to one
        another and settle their own legal form before any money moves.{" "}
        <Link href="/how-it-works">How it works</Link>.
      </p>
    </main>
  );
}
