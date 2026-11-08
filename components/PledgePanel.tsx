"use client";

import { useEffect, useState } from "react";
import { money } from "@/lib/data";

const PRESETS = [500, 1_000, 5_000, 25_000];

type Agg = { count: number; totalCents: number; recent: { name: string; amountCents: number; at: string }[] };

export default function PledgePanel({ listingId, priceUsd }: { listingId: string; priceUsd: number }) {
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
  const pct = Math.min(100, (agg.totalCents / goal) * 100);

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
        setError(data?.error ?? "That didn't go through.");
        setStatus("idle");
        return;
      }
      setAgg(data);
      setStatus("done");
      setName("");
      setEmail("");
      setNote("");
    } catch {
      setError("Network trouble. Try again.");
      setStatus("idle");
    }
  }

  return (
    <aside className="panel" id="pledge">
      <h3>Pledge toward this building</h3>
      <div className="goal">
        {agg.count === 0
          ? `Be the first name on it · goal ${money(goal)}`
          : `${agg.count} ${agg.count === 1 ? "pledge" : "pledges"} · ${money(agg.totalCents)} of ${money(goal)}`}
      </div>
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="bar-meta">
        <span>{pct < 0.1 ? "0%" : `${pct.toFixed(pct < 10 ? 1 : 0)}%`} of asking price</span>
        <span>{money(Math.max(0, goal - agg.totalCents))} to go</span>
      </div>

      {status === "done" ? (
        <div className="msg ok">
          <p style={{ marginBottom: 8 }}>
            <strong>You&apos;re on the list.</strong> We&apos;ll email {email || "you"} when this
            building gets within reach of its number.
          </p>
          <button className="btn ghost" onClick={() => setStatus("idle")}>
            Add another pledge
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="amounts">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                data-on={amount === p}
                onClick={() => setAmount(p)}
                aria-pressed={amount === p}
              >
                {p < 1000 ? `$${p}` : `$${p / 1000}k`}
              </button>
            ))}
          </div>

          <label htmlFor="amt">Your amount (USD)</label>
          <input
            id="amt"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(Math.max(5, Number(e.target.value.replace(/[^\d]/g, "")) || 0))}
          />

          <label htmlFor="name">Name to show</label>
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

          <label htmlFor="note">Why this one? (optional)</label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Baptized here. Want the organ to stay."
          />

          <button className="btn brass" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Recording…" : `Pledge ${money(amount * 100)}`}
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
