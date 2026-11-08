import Atlas from "@/components/Atlas";
import { countryCount, fmt, listings, pricedCount, stateCount, totalAsking } from "@/lib/data";

export default function Home() {
  const prices = listings.map((l) => l.price_usd).filter((p): p is number => p != null).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const cheapest = prices[0];

  return (
    <main>
      <section className="hero">
        <div className="shell">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">
                {countryCount()} countries · updated{" "}
                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <h1>
                Somewhere near you,
                <br />
                a church is <em>for sale.</em>
              </h1>
              <p className="lede">
                Congregations shrink, buildings empty, and the steeple goes to whoever has the
                cash. We think the neighborhood should get a shot first — so here is every one of
                them on a map, from the American main street to an English village to a French
                hamlet, with a way to put your name and a number next to the one you cannot stand
                to lose.
              </p>
            </div>
            <aside className="hero-note">
              <p>
                <strong>{listings.length.toLocaleString("en-US")} buildings</strong> across{" "}
                <strong>{stateCount()} states, England and France</strong>, asking{" "}
                <strong>{fmt(totalAsking())}</strong> in total.
              </p>
              <p>
                A pledge here is a public signal — a name and an amount. No money moves. When a
                building gets close to its number, the group meets a title company.
              </p>
            </aside>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="n">{listings.length.toLocaleString("en-US")}</div>
              <div className="k">Churches on the market</div>
            </div>
            <div className="stat">
              <div className="n">{fmt(median)}</div>
              <div className="k">Median asking price</div>
            </div>
            <div className="stat">
              <div className="n">{fmt(cheapest)}</div>
              <div className="k">Cheapest on the map</div>
            </div>
            <div className="stat">
              <div className="n">{fmt(totalAsking())}</div>
              <div className="k">
                Combined asking price
                <br />
                <span style={{ fontSize: "0.78rem", letterSpacing: 0 }}>
                  {pricedCount()} priced · {listings.length - pricedCount()} offers invited
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Atlas listings={listings} />
    </main>
  );
}
