import Atlas from "@/components/Atlas";
import { fmt, listings, pricedCount, stateCount, totalAsking } from "@/lib/data";

export default function Home() {
  const prices = listings
    .map((l) => l.price_usd)
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const cheapest = prices[0];

  return (
    <main>
      <section className="hero">
        <div className="shell">
          <h1>Church Buildings Offered for Sale</h1>
          <hr className="title-rule" />
          <p className="lede">
            This register records {listings.length} church buildings currently on the open market
            in {stateCount()} American states, in England, and in France. Each entry gives the
            building, its situation, the asking price in the seller&apos;s own currency, and the
            source of the particulars. The lowest asking price on the register is{" "}
            {fmt(cheapest)}; the median is {fmt(median)}; the {pricedCount()} priced lots together
            ask {fmt(totalAsking())}, and the remaining {listings.length - pricedCount()} invite
            offers.
          </p>
          <p className="lede">
            Any reader may enter a pledge against a building: a name and an amount, recorded
            publicly. No money is taken. When the pledges against a building approach its asking
            price, the pledgers are introduced to one another and to a title company, and the
            purchase proceeds by the ordinary means.
          </p>
          <span className="ornament" aria-hidden="true" />
        </div>
      </section>

      <Atlas listings={listings} />

      <section className="provenance" id="provenance">
        <div className="shell">
          <p className="eyebrow">Where this came from</p>
          <blockquote className="provenance-quote">
            <p>
              You should perhaps make a website that highlights opportunities. &ldquo;Adopt a
              church.&rdquo; I&apos;ll adopt one if you do this.
            </p>
            <cite>Patrick Collison, replying to Riva Tez on X, 8 November 2026</cite>
          </blockquote>
          <p className="provenance-note">
            The exchange that started it is at{" "}
            <a
              href="https://x.com/rivatez/status/2119514722894770572"
              rel="noopener noreferrer"
              target="_blank"
            >
              x.com/rivatez
            </a>
            , and the list of English buildings comes from the Church of England&apos;s own
            disposal register.
          </p>
        </div>
      </section>
    </main>
  );
}
