import Atlas from "@/components/Atlas";
import { listings, money, stateCount, totalAsking } from "@/lib/data";

export default function Home() {
  const median = [...listings].map((l) => l.price_usd).sort((a, b) => a - b)[
    Math.floor(listings.length / 2)
  ];

  return (
    <main>
      <section className="hero">
        <div className="shell">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">A national atlas · updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
              <h1>
                Somewhere near you,
                <br />
                a church is <em>for sale.</em>
              </h1>
              <p className="lede">
                Congregations shrink, buildings empty, and the steeple goes to whoever has the
                cash. We think the neighborhood should get a shot first — so here is every one of
                them on a map, with a way to put your name and a number next to the one you cannot
                stand to lose.
              </p>
            </div>
            <aside className="hero-note">
              <p>
                <strong>{listings.length.toLocaleString("en-US")} buildings</strong> across{" "}
                <strong>{stateCount()} states</strong>, asking{" "}
                <strong>{money(totalAsking() * 100)}</strong> in total.
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
              <div className="n">{money(median * 100)}</div>
              <div className="k">Median asking price</div>
            </div>
            <div className="stat">
              <div className="n">{money(totalAsking() * 100)}</div>
              <div className="k">Combined asking price</div>
            </div>
          </div>
        </div>
      </section>

      <Atlas listings={listings} />
    </main>
  );
}
