import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MiniMap from "@/components/MiniMap";
import PledgePanel from "@/components/PledgePanel";
import { countryName, getListing, listings, priceLabel, usdApprox, whereLabel } from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const l = getListing(id);
  if (!l) return { title: "Not found — adoptchurches" };
  return {
    title: `${l.name} — ${priceLabel(l)} in ${l.city}, ${l.region ?? l.state ?? countryName(l.country)}`,
    description: l.description.slice(0, 180),
  };
}

export default async function ChurchPage({ params }: Props) {
  const { id } = await params;
  const l = getListing(id);
  if (!l) notFound();

  const approx = usdApprox(l);

  return (
    <main className="detail">
      <div className="shell detail-grid">
        <div>
          <Link href="/#atlas" className="back">
            ← Back to the atlas
          </Link>

          <div className="eyebrow" style={{ marginTop: 22 }}>
            For sale · {whereLabel(l)}
            {l.grade ? ` · ${l.grade}` : ""}
            {l.status === "Under offer" ? " · under offer" : ""}
          </div>
          <h1>{l.name}</h1>
          <div className="addr">{l.address}</div>

          <div className="price-line">
            <div className="p">{priceLabel(l)}</div>
            <div className="sub">
              {l.price_local == null ? "guide price on application" : "asking price"}
              {approx ? ` · ${approx} at today's rate` : ""} · {l.source}
            </div>
          </div>

          <hr className="section-rule" />

          <div className="prose">
            {l.description.split(/\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <MiniMap lat={l.lat} lng={l.lng} label={l.name} />

          <hr className="section-rule" />

          <h2 style={{ fontSize: "1.6rem", marginBottom: 14 }}>How buying it together would work</h2>
          <ol className="prose" style={{ paddingLeft: 22 }}>
            <li>
              <strong>Pledge a number.</strong> Your name and amount go on this page. It is a
              signal, not a payment — nobody is charged, and you can ask to be removed at any
              time.
            </li>
            <li>
              <strong>Reach the number.</strong> When pledges cover the asking price (plus a
              reserve for closing costs, title, survey and the first year of upkeep), the page
              closes and the group is introduced.
            </li>
            <li>
              <strong>Form the entity.</strong> Neighbors decide the structure — a nonprofit, a
              co-op, a land trust, or a single buyer with donations. A real-estate attorney drafts
              it; a title company or solicitor holds funds in escrow.
            </li>
            <li>
              <strong>Buy, then decide what it is.</strong> Worship, a community hall, a school,
              housing, or simply keeping the doors open and the organ playing. The deed records
              the promise.
            </li>
          </ol>

          <p className="prose" style={{ color: "var(--ink-mute)", fontSize: "0.95rem" }}>
            Listing via {l.source}.{" "}
            <a
              href={l.contact_url ?? l.source_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              See the original listing
            </a>
            . Prices and availability change; verify with the agent before acting.
          </p>
        </div>

        <PledgePanel listingId={l.id} priceUsd={l.price_usd ?? 0} priceLabelText={priceLabel(l)} />
      </div>
    </main>
  );
}
