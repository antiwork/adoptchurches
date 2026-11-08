import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works — adoptchurches",
  description:
    "Every church for sale in one atlas, and a pledge registry so a neighborhood can buy one back together.",
};

export default function HowItWorks() {
  return (
    <main className="shell doc">
      <div className="eyebrow">The idea</div>
      <h1>Every steeple for sale, in one place — and a way to say “not this one.”</h1>

      <p>
        Churches close for ordinary reasons: the congregation ages, the roof needs a hundred
        thousand dollars, the diocese consolidates. The building goes on the commercial market
        next to a Wendy&apos;s. The people who were baptized in it usually find out from the
        “For Sale” sign — long after the price was set and the buyer was picked.
      </p>
      <p>
        This site does two things. It gathers church buildings currently for sale across the
        country onto one map, so you can see what is happening within driving distance of you.
        And it lets you attach your name and a number to a building, so a group can form around
        it before the deal is done.
      </p>

      <h2 id="pledge">What a pledge is</h2>
      <p>
        A pledge is a public expression of intent: a name, an amount, and optionally a reason.
        It is recorded so the next person can see the building is not alone. It is <em>not</em> a
        payment. No card is collected, no money moves, and no escrow account exists yet.
      </p>
      <p>
        If a building&apos;s pledges approach its asking price, we introduce the pledgers to a
        title company and a real-estate attorney. At that point the group decides the legal form —
        a nonprofit, a co-op, a community land trust, or one buyer collecting donations — and
        money starts moving under that entity, through escrow, with documents. Nothing before that
        point is binding on anyone.
      </p>

      <h2>Why pledges instead of a fund</h2>
      <p>
        A fund would need to be a security, with all the registration that implies. A map plus a
        list of names does not. Keeping the site at the “signal” stage is what makes it possible
        for a hundred small groups to form in a hundred towns without one central entity deciding
        which buildings live.
      </p>

      <h2>What this is not</h2>
      <ul>
        <li>
          Not a broker or an agent. We do not represent sellers, and we do not negotiate price.
        </li>
        <li>
          Not an offer of securities, a solicitation of investment, or a crowdfunding portal under
          Regulation CF. No funds are accepted on this site.
        </li>
        <li>
          Not a guarantee that a listed building is available, or that the price is right. Listing
          data comes from public commercial real-estate sources and goes stale — verify with the
          broker.
        </li>
        <li>
          Not affiliated with any congregation, denomination, or the listing sites themselves.
        </li>
      </ul>

      <h2>Where the data comes from</h2>
      <p>
        Every building here is a real, currently-listed property, and every row links back to the
        source that published it: public commercial real-estate indexes in the United States, the
        Church of England&apos;s official list of <em>closed church buildings available for
        disposal</em>, and Patrice Besse&apos;s register of religious edifices for sale in France.
        The harvest is reproducible — see <code>scripts/</code> in the repository — and prices are
        shown in the seller&apos;s own currency, with a dollar figure converted at a rate recorded
        in <code>data/fx.json</code>.
      </p>
      <p>
        The dataset is deliberately conservative: a building appears only when its own listing
        text describes a religious building, not because a street happens to be named Church
        Street, and land parcels with no building on them are dropped.
      </p>

      <h2>Build it yourself</h2>
      <p>
        This is a prototype and the whole thing is in the open: a Next.js app, a JSON file of
        listings, a pledge endpoint. If your town has a building on this map, fork it, host it,
        and put your own name on the list.
      </p>
    </main>
  );
}
