import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · adoptchurches",
  description:
    "A register of church buildings offered for disposal, and a pledge book by which neighbours can put their support behind saving one. No money moves through this site.",
};

export default function HowItWorks() {
  return (
    <main className="shell doc">
      <div className="eyebrow">The idea</div>
      <h1>A register of churches offered for disposal, and a pledge book</h1>
      <hr className="title-rule" />

      <p>
        Churches close for ordinary reasons: the congregation ages, the roof wants repair the parish
        cannot pay for, the diocese consolidates. The building then goes to the commercial market, and
        the people who were baptized in it commonly learn of it from the sign, once the price is set
        and a buyer is found.
      </p>
      <p>
        This site does two things. It gathers the church buildings presently offered for disposal in
        the United States, England and France onto one map, so a reader can see what is at stake
        within driving distance. And it keeps a pledge book, in which anyone may set a name, an
        amount and a reason against a building, so that the people who would look after it can find
        each other before it is gone.
      </p>

      <h2 id="pledge">What a pledge is</h2>
      <p>
        A pledge is a public promise of support: a name, an amount, and if the pledger wishes, a
        reason. It is recorded so that the next reader can see a group forming. It is not a payment.
        No card is taken, nothing is charged, and no money is held anywhere on this site.
      </p>
      <p>
        As the support against a building grows toward the figure asked, the names in the book are put
        in touch with one another. The group settles its own legal form — a nonprofit, a co-operative,
        a community land trust, a friends group, or one neighbour collecting gifts from others — and
        money begins to move only then, under that entity, through escrow, with documents. Nothing
        before that point binds anyone, and a pledge may be withdrawn by asking.
      </p>

      <h2>Why a book of names rather than a fund</h2>
      <p>
        A pooled fund would be a security, with the registration and the gatekeeping that implies. A
        register and a list of names is not. Keeping the site at the stage of declared support is what
        lets a hundred small groups form in a hundred towns without a central body deciding which
        buildings are worth saving.
      </p>

      <h2>What this is not</h2>
      <ul>
        <li>Not a shop. There is no basket, no cart and no checkout on this site.</li>
        <li>Not a broker or an agent. It represents no seller and negotiates no price.</li>
        <li>
          Not an offer of securities, a solicitation of investment, or a crowdfunding portal under
          Regulation CF. No funds are accepted here.
        </li>
        <li>
          Not a guarantee that a listed building remains available, or that its price is current. The
          particulars come from public sources and go stale; verify with the agent.
        </li>
        <li>Not affiliated with any congregation, denomination, or with the listing sites themselves.</li>
      </ul>

      <h2>Where the particulars come from</h2>
      <p>
        Every building in the register is a real property presently listed, and every entry links to
        the source that published it: public commercial real-estate indexes in the United States, the
        Church of England&apos;s official list of <em>closed church buildings available for
        disposal</em>, and Patrice Besse&apos;s register of religious edifices for sale in France. The
        harvest is reproducible; see <code>scripts/</code> in the repository. Prices are shown in the
        seller&apos;s own currency, with a dollar figure converted at a rate recorded in{" "}
        <code>data/fx.json</code>.
      </p>
      <p>
        The register is kept deliberately narrow. A building appears only when its own listing
        describes a religious building, not because its street happens to be named Church Street, and
        parcels of land with no building on them are excluded.
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
        . The list of English buildings comes from the Church of England&apos;s own disposal register.
      </p>

      <h2>Build it yourself</h2>
      <p>
        This is a prototype, and the whole of it is open: a Next.js application, a JSON file of
        listings, a pledge endpoint. If your town has a building on this map, fork it, host it, and
        set your own name in the book.
      </p>
    </main>
  );
}
