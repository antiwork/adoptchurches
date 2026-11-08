import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · Adopt Churches",
  description:
    "A register of church buildings for sale, and a pledge book by which a group of neighbours may buy one together.",
};

export default function HowItWorks() {
  return (
    <main className="shell doc">
      <div className="eyebrow">The idea</div>
      <h1>A register of churches for sale, and a pledge book</h1>
      <hr className="title-rule" />

      <p>
        Churches close for ordinary reasons: the congregation ages, the roof wants repair the
        parish cannot pay for, the diocese consolidates. The building then goes to the commercial
        market, and the people who were baptized in it commonly learn of the sale from the sign,
        after the price has been set and a buyer found.
      </p>
      <p>
        This site does two things. It gathers the church buildings currently offered for sale in
        the United States, England and France onto one map, so a reader can see what is offered
        within driving distance. It also keeps a pledge book, in which a reader may set a name
        and an amount against a particular building, so that a group can form around it before
        the sale concludes.
      </p>

      <h2 id="pledge">What a pledge is</h2>
      <p>
        A pledge is a public declaration of intent: a name, an amount, and if the pledger wishes,
        a reason. It is recorded so that the next reader can see a group forming. It is not a
        payment. No card is collected, no money moves, and no escrow account exists at this
        stage.
      </p>
      <p>
        If the pledges against a building approach its asking price, the pledgers are introduced
        to a title company and a real-estate attorney. The group then settles its legal form,
        whether a nonprofit, a co-operative, a community land trust, or one buyer collecting
        donations, and money begins to move under that entity, through escrow, with documents.
        Nothing before that point binds anyone.
      </p>

      <h2>Why pledges rather than a fund</h2>
      <p>
        A pooled fund would be a security, with the registration that implies. A map and a list
        of names is not. Keeping the site at the stage of declared intent is what allows a
        hundred small groups to form in a hundred towns without a central entity deciding which
        buildings are bought.
      </p>

      <h2>What this is not</h2>
      <ul>
        <li>
          Not a broker or an agent. The site represents no seller and negotiates no price.
        </li>
        <li>
          Not an offer of securities, a solicitation of investment, or a crowdfunding portal
          under Regulation CF. No funds are accepted on this site.
        </li>
        <li>
          Not a guarantee that a listed building remains available, or that its price is
          current. The particulars come from public commercial sources and go stale; verify with
          the agent.
        </li>
        <li>
          Not affiliated with any congregation, denomination, or with the listing sites
          themselves.
        </li>
      </ul>

      <h2>Where the particulars come from</h2>
      <p>
        Every building in the register is a real property presently listed, and every entry
        links to the source that published it: public commercial real-estate indexes in the
        United States, the Church of England&apos;s official list of <em>closed church buildings
        available for disposal</em>, and Patrice Besse&apos;s register of religious edifices for
        sale in France. The harvest is reproducible; see <code>scripts/</code> in the
        repository. Prices are shown in the seller&apos;s own currency, with a dollar figure
        converted at a rate recorded in <code>data/fx.json</code>.
      </p>
      <p>
        The register is kept deliberately narrow. A building appears only when its own listing
        describes a religious building, not because its street happens to be named Church
        Street, and parcels of land with no building on them are excluded.
      </p>

      <h2>Where this came from</h2>
      <blockquote className="provenance-quote">
        <p>
          You should perhaps make a website that highlights opportunities. &ldquo;Adopt a
          church.&rdquo; I&apos;ll adopt one if you do this.
        </p>
        <cite>Patrick Collison, replying to Riva Tez on X, 8 November 2026</cite>
      </blockquote>
      <p>
        The exchange that started it is at{" "}
        <a
          href="https://x.com/rivatez/status/2119514722894770572"
          rel="noopener noreferrer"
          target="_blank"
        >
          x.com/rivatez
        </a>
        . The list of English buildings comes from the Church of England&apos;s own disposal
        register.
      </p>

      <h2>Build it yourself</h2>
      <p>
        This is a prototype, and the whole of it is open: a Next.js application, a JSON file of
        listings, a pledge endpoint. If your town has a building on this map, fork it, host it,
        and set your own name in the book.
      </p>
    </main>
  );
}
