"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/data";

const PRESETS = [500, 1_000, 5_000, 25_000];

type Agg = { count: number; totalCents: number; recent: { name: string; amountCents: number; at: string }[] };

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
  const [amount, setAmount] = useState<number>(1_000);
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

  return (
    <aside className="panel" id="pledge">
      <h3>The pledge book</h3>
      <hr className="panel-rule" />
      <div className="goal">
        {!hasGoal
          ? agg.count === 0
            ? "No asking price is published. A pledge records that a group is forming." +
              (priceLabelText ? ` ${priceLabelText}.` : "")
            : `${agg.count} ${agg.count === 1 ? "pledge" : "pledges"} entered, amounting to ${money(agg.totalCents)}.` +
              (priceLabelText ? ` Guide price ${priceLabelText.toLowerCase()}.` : "")
          : agg.count === 0
            ? `No pledge has yet been entered. The asking price is ${money(goal)}${
                priceLabelText && !priceLabelText.startsWith("$") ? ` (${priceLabelText})` : ""
              }.`
            : `${agg.count} ${agg.count === 1 ? "pledge" : "pledges"} entered, amounting to ${money(
                agg.totalCents,
              )} of the ${money(goal)} asked. ${money(Math.max(0, goal - agg.totalCents))} remains.`}
      </div>

      {status === "done" ? (
        <div className="msg ok">
          <p style={{ marginBottom: 10 }}>
            Your pledge is entered in the book. Word will be sent to {email || "you"} when the
            pledges against this building approach its price.
          </p>
          <button className="btn" onClick={() => setStatus("idle")}>
            Enter another pledge
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="amt">Amount (USD)</label>
          <div className="amounts">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                data-on={amount === p}
                onClick={() => setAmount(p)}
                aria-pressed={amount === p}
              >
                {p < 1000 ? `$${p}` : `$${(p / 1000).toLocaleString("en-US")},000`}
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
            A pledge records intent, not money. No card is taken, nothing is charged, and no
            securities are offered or sold.
          </div>
        </form>
      )}

      {agg.recent.length > 0 && (
        <div className="recent">
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
