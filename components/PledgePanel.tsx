"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/data";

const PRESETS = [100, 500, 1_000, 5_000];

type Agg = { count: number; totalCents: number; recent: { name: string; amountCents: number; at: string }[] };

/**
 * The pledge book: the only action on the site, and deliberately not a
 * transaction. A name, an amount and a reason, recorded so the next reader can
 * see a group forming. No card, no order, nothing charged.
 */
export default function PledgePanel({
  listingId,
  priceUsd,
  priceLabelText,
}: {
  listingId: string;
  priceUsd: number;
  priceLabelText?: string;
}) {
  const [agg, setAgg] = useState<Agg>({ count: 0, totalCents: 0, recent: [] });
  const [amount, setAmount] = useState<number>(500);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/pledges?listing=${encodeURIComponent(listingId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setAgg(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [listingId]);

  const goal = priceUsd * 100;
  const hasGoal = goal > 0;
  const pct = hasGoal ? Math.min(100, Math.round((agg.totalCents / goal) * 100)) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, name, email, note, amountCents: Math.round(amount * 100) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "The pledge was not recorded. Try once more.");
        setStatus("idle");
        return;
      }
      setAgg(data);
      setStatus("done");
      setName("");
      setEmail("");
      setNote("");
    } catch {
      setError("The connection failed. Try once more.");
      setStatus("idle");
    }
  }

  const priceNote = priceLabelText ? ` The guide price is ${priceLabelText.toLowerCase()}.` : "";

  return (
    <aside className="panel" id="support">
      <div className="panel-kicker">The pledge book</div>
      <h3>Pledge your support</h3>
      <hr className="panel-rule" />

      <div className="pledge-state">
        {agg.count === 0 ? (
          <div className="pledge-total">
            <strong>No pledge yet.</strong>
            {hasGoal
              ? priceNote
              : " A pledge is a name and an amount, recorded so that a group can form."}
          </div>
        ) : (
          <div className="pledge-total">
            <strong>{money(agg.totalCents)}</strong> pledged by {agg.count}{" "}
            {agg.count === 1 ? "person" : "people"}
            {hasGoal ? `, against ${priceLabelText ?? money(goal)} asked.` : "."}
          </div>
        )}

        {hasGoal && (
          <>
            <div className="pledge-bar" data-complete={pct >= 100} aria-hidden="true">
              <i style={{ width: `${Math.max(pct, agg.count ? 2 : 0)}%` }} />
            </div>
            <div className="pledge-left">
              {pct}% of the guide price
            </div>
          </>
        )}
      </div>

      {status === "done" ? (
        <div className="msg ok">
          <p style={{ marginBottom: 10 }}>
            Your name is in the pledge book. Word will be sent to {email || "you"} as the support
            against this building grows.
          </p>
          <button className="btn" onClick={() => setStatus("idle")}>
            Add another pledge
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="amt">What would you put behind it? (USD)</label>
          <div className="amounts">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                data-on={amount === p}
                onClick={() => setAmount(p)}
                aria-pressed={amount === p}
              >
                {p >= 1000 ? `$${p.toLocaleString("en-US")}` : `$${p}`}
              </button>
            ))}
          </div>
          <input
            id="amt"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(Math.max(5, Number(e.target.value.replace(/[^\d]/g, "")) || 0))}
          />

          <label htmlFor="name">Name, as it will appear</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dana R." required />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label htmlFor="note">Reason, if you care to give one</label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Baptized here. The organ should stay."
          />

          <button className="btn brass" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Recording" : `Pledge ${money(amount * 100)}`}
          </button>
          {error && <div className="msg err">{error}</div>}
          <div className="fine">
            A pledge is a promise of support, not a payment. No card is taken, nothing is charged,
            and no securities are offered or sold.
          </div>
        </form>
      )}

      {agg.recent.length > 0 && (
        <div className="recent">
          <div className="recent-head">In the book so far</div>
          {agg.recent.map((r, i) => (
            <div key={i}>
              <span>{r.name}</span>
              <span>{money(r.amountCents)}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
