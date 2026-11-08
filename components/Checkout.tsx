"use client";

// The order form and the receipt. A stationer's form in two columns.
// The order itself is real: it is written into the database and a letter of
// record goes out by email. The payment block is a joke, and says so.

import { useMemo, useState } from "react";
import Link from "next/link";
import { displayName, fmt, getListing, priceLabel, whereLabel } from "@/lib/data";
import {
  emptyBasket,
  saveReceipt,
  useBasket,
  useReceipts,
  type Receipt,
} from "@/lib/store";

const RESERVE_RATE = 0.04;

export default function Checkout() {
  const basket = useBasket();
  const receipts = useReceipts();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [town, setTown] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sealed, setSealed] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const lines = useMemo(
    () =>
      basket
        .map((b) => getListing(b.id))
        .filter((l): l is NonNullable<typeof l> => l != null),
    [basket],
  );

  const subtotal = lines.reduce((s, l) => s + (l.price_usd ?? 0), 0);
  const reserve = Math.round(subtotal * RESERVE_RATE);
  const total = subtotal + reserve;
  const unpriced = lines.filter((l) => l.price_usd == null).length;

  async function seal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) {
      setError("Give a name for the register.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Give an email that will carry a letter.");
      return;
    }
    if (lines.length === 0) {
      setError("The basket is empty. Return to the atlas and choose a building.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          town: town.trim() || undefined,
          note: note.trim() || undefined,
          items: lines.map((l) => ({ listingId: l.id, qty: 1 })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        order?: {
          reference: string;
          createdAt: string;
          subtotalCents: number;
          reserveCents: number;
          totalCents: number;
        };
        emailError?: string | null;
      };

      if (!response.ok || !payload.order) {
        setError(payload.error ?? "The register would not take the order. Try again.");
        return;
      }

      const order = payload.order;
      const receipt: Receipt = {
        serial: `No. ${order.reference}`,
        at: order.createdAt,
        name: trimmedName,
        email: trimmedEmail,
        town: town.trim() || undefined,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          id: l.id,
          name: displayName(l),
          where: whereLabel(l),
          priceUsd: l.price_usd,
          priceLabel: priceLabel(l),
        })),
        subtotalUsd: order.subtotalCents / 100,
        reserveUsd: order.reserveCents / 100,
        totalUsd: order.totalCents / 100,
      };
      saveReceipt(receipt);
      emptyBasket();
      setSealed(receipt);
      setNotice(
        payload.emailError
          ? "The order is in the register, but the letter could not be sent."
          : `A letter of record is on its way to ${trimmedEmail}.`,
      );
      window.scrollTo({ top: 0 });
    } catch {
      setError("The register could not be reached. Nothing was entered; try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (sealed) {
    return (
      <main className="checkout">
        <div className="shell">
          {notice && <p className="receipt-notice no-print">{notice}</p>}
          <ReceiptSheet receipt={sealed} fresh />
          <p className="checkout-return no-print">
            <Link href="/">Return to the atlas</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout">
      <div className="shell">
        <p className="back-line no-print">
          <Link href="/" className="back">
            Return to the atlas
          </Link>
        </p>
        <h1>Order form for the adoption of buildings</h1>
        <hr className="title-rule" />

        {lines.length === 0 ? (
          <div className="checkout-empty">
            <p>
              The basket is empty. Choose a building from the atlas and mark it &ldquo;add to
              basket&rdquo;; the order form will draw itself up here.
            </p>
            {receipts.length === 0 && (
              <p>
                <Link href="/">To the atlas</Link>
              </p>
            )}
          </div>
        ) : (
          <div className="order-grid">
            <section className="order-lines" aria-label="The order">
              <h2 className="smallcaps">The order</h2>
              <table className="order-table">
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.id}>
                      <td className="order-no">{i + 1}.</td>
                      <td>
                        <div className="order-name">{displayName(l)}</div>
                        <div className="order-where">{whereLabel(l)}</div>
                      </td>
                      <td className="order-price">{priceLabel(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr className="dashed-rule" />
              <dl className="order-sums">
                <div>
                  <dt>Asking, together{unpriced > 0 ? ` (${unpriced} by offer, not summed)` : ""}</dt>
                  <dd>{fmt(subtotal)}</dd>
                </div>
                <div>
                  <dt>Reserve for title, survey and closing costs (4%)</dt>
                  <dd>{fmt(reserve)}</dd>
                </div>
                <div className="order-total">
                  <dt>Total</dt>
                  <dd id="checkout-total">{fmt(total)}</dd>
                </div>
              </dl>
              <p className="order-fine">
                This is a demonstration. No payment has been taken, no building has changed hands,
                and no securities are offered.
              </p>
            </section>

            <section className="order-form" aria-label="Particulars of the adopter">
              <h2 className="smallcaps">Particulars of the adopter</h2>
              <form onSubmit={seal} noValidate>
                <label htmlFor="co-name">Name, in full</label>
                <input
                  id="co-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dana Rowe"
                  autoComplete="name"
                  required
                />

                <label htmlFor="co-email">Email, for the letter of record</label>
                <input
                  id="co-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />

                <label htmlFor="co-town">Town</label>
                <input
                  id="co-town"
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                  placeholder="Wichita"
                  autoComplete="address-level2"
                />

                <label htmlFor="co-note">A note, if you care to leave one</label>
                <textarea
                  id="co-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="For the bell tower."
                />

                <fieldset className="mock-pay">
                  <legend className="smallcaps">Terms of payment</legend>
                  <p className="pay-line">
                    Settled in pledges and good intentions. <em>No card is asked for, no account
                    is debited, and nothing is sent anywhere.</em>
                  </p>
                  <p className="order-fine">
                    This is a demonstration of the register, not a shop. The order is entered for
                    posterity only.
                  </p>
                </fieldset>

                {error && <div className="msg err">{error}</div>}

                <button type="submit" className="seal-button" disabled={busy}>
                  <span className="seal-button-wax" aria-hidden="true" />
                  {busy ? "Sealing…" : "Seal the adoption"}
                </button>
              </form>
            </section>
          </div>
        )}

        {receipts.length > 0 && (
          <section className="past-receipts no-print" aria-label="Past receipts">
            <hr className="section-rule" />
            <h2 className="smallcaps">Receipts on file</h2>
            {receipts.map((r) => (
              <ReceiptSheet key={r.serial + r.at} receipt={r} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function ReceiptSheet({ receipt, fresh = false }: { receipt: Receipt; fresh?: boolean }) {
  const dated = new Date(receipt.at);
  return (
    <div className="receipt-wrap" {...(fresh ? { id: "receipt" } : {})}>
      <div className="receipt" data-serial={receipt.serial}>
        <div className="receipt-stamp" aria-hidden="true">
          Adopted
        </div>
        <div className="receipt-head">
          <div className="receipt-wordmark">
            adopt<em>churches</em>
          </div>
          <div className="receipt-serial">{receipt.serial}</div>
        </div>
        <div className="receipt-dateline">
          Entered in the register, {dated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          , for {receipt.name}
          {receipt.town ? ` of ${receipt.town}` : ""}.
        </div>
        <hr className="rule-double" />
        <table className="receipt-table">
          <tbody>
            {receipt.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="order-no">{i + 1}.</td>
                <td>
                  <div className="order-name">{l.name}</div>
                  <div className="order-where">{l.where}</div>
                </td>
                <td className="order-price">{l.priceLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="dashed-rule" />
        <dl className="order-sums">
          <div>
            <dt>Asking, together</dt>
            <dd>{fmt(receipt.subtotalUsd)}</dd>
          </div>
          <div>
            <dt>Reserve for title, survey and closing costs (4%)</dt>
            <dd>{fmt(receipt.reserveUsd)}</dd>
          </div>
          <div className="order-total">
            <dt>Total</dt>
            <dd>{fmt(receipt.totalUsd)}</dd>
          </div>
        </dl>
        {receipt.note && <p className="receipt-note">&ldquo;{receipt.note}&rdquo;</p>}
        <p className="receipt-fine">
          This is a demonstration. No payment has been taken, no building has changed hands, and no
          securities are offered.
        </p>
      </div>
      <div className="receipt-actions no-print">
        <button type="button" className="btn" onClick={() => window.print()}>
          Print or save
        </button>
      </div>
    </div>
  );
}
