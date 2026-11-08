import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DetailActions from "@/components/DetailActions";
import ListingPhoto from "@/components/ListingPhoto";
import MiniMap from "@/components/MiniMap";
import PledgePanel from "@/components/PledgePanel";
import {
  countryName,
  displayAddress,
  displayName,
  getListing,
  listings,
  priceLabel,
  titleCase,
  usdApprox,
  whereLabel,
} from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return listings.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const l = getListing(id);
  if (!l) return { title: "Not found · Adopt Churches" };
  return {
    title: `${displayName(l)} · ${priceLabel(l)} · ${l.city}, ${titleCase(l.region ?? l.state ?? countryName(l.country))}`,
    description: l.description.slice(0, 180),
  };
}

export default async function ChurchPage({ params }: Props) {
  const { id } = await params;
  const l = getListing(id);
  if (!l) notFound();

  const approx = usdApprox(l);
  const regionLabel =
    l.country === "US" ? "State" : l.country === "GB" ? "Diocese" : "Region";

  return (
    <main className="detail">
      <div className="shell detail-grid">
        <div>
          <Link href="/#atlas" className="back">
            Return to the atlas
          </Link>

          <h1>{displayName(l)}</h1>
          <div className="addr">{displayAddress(l)}</div>

          <ListingPhoto id={l.id} alt={displayName(l)} size="hero" className="detail-photo" credit={l.source} />

          <div className="price-line">
            <div className="p">{priceLabel(l)}</div>
            <div className="sub">
              {l.price_local == null ? "guide price on application" : "asking price"}
              {approx ? ` · ${approx} at the recorded rate` : ""} · {l.source}
            </div>
          </div>

          <DetailActions id={l.id} name={displayName(l)} />

          <span className="ornament" aria-hidden="true" />

          <h2>The building</h2>
          <div className={`prose justified${l.description.length >= 200 ? " dropcap" : ""}`}>
            {l.description.split(/\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <hr className="section-rule" />

          <h2>Particulars</h2>
          <table className="particulars">
            <tbody>
              <tr>
                <th scope="row">Situation</th>
                <td>{whereLabel(l)}, {countryName(l.country)}</td>
              </tr>
              {l.grade ? (
                <tr>
                  <th scope="row">Grade</th>
                  <td>{l.grade}</td>
                </tr>
              ) : null}
              <tr>
                <th scope="row">{regionLabel}</th>
                <td>{titleCase(l.region ?? l.state ?? countryName(l.country))}</td>
              </tr>
              <tr>
                <th scope="row">Guide price</th>
                <td>
                  {priceLabel(l)}
                  {approx ? ` (${approx})` : ""}
                </td>
              </tr>
              <tr>
                <th scope="row">Agent or source</th>
                <td>
                  <a
                    href={l.contact_url ?? l.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {l.contact ?? l.source}
                  </a>
                </td>
              </tr>
              <tr>
                <th scope="row">Status</th>
                <td>{l.status ?? "Available"}</td>
              </tr>
            </tbody>
          </table>

          <div className="plate">
            <div className="map-frame">
              <MiniMap lat={l.lat} lng={l.lng} label={l.name} />
            </div>
            <div className="plate-caption">Plate II · situation of the building</div>
          </div>

          <h2>How a group buys it</h2>
          <ol className="steps">
            <li>
              A reader enters a pledge: a name and an amount, recorded on this page. It is a
              declaration of intent, not a payment. Nothing is charged, and a pledge may be
              withdrawn on request.
            </li>
            <li>
              When the pledges against the building cover the asking price, together with a
              reserve for closing costs, title, survey and the first year of upkeep, the page
              closes and the pledgers are introduced to one another.
            </li>
            <li>
              The group settles its legal form: a nonprofit, a co-operative, a land trust, or a
              single buyer collecting donations. An attorney drafts the instrument, and a title
              company or solicitor holds the funds in escrow.
            </li>
            <li>
              The purchase completes, and the group decides the building&apos;s use: worship, a
              hall, a school, housing, or simple preservation. The deed records the arrangement.
            </li>
          </ol>

          <p className="prose" style={{ color: "var(--ink-2)", fontSize: "0.92rem" }}>
            Particulars supplied by {l.source}.{" "}
            <a href={l.contact_url ?? l.source_url} target="_blank" rel="noopener noreferrer nofollow">
              See the original listing
            </a>
            . Prices and availability change; verify every particular with the agent before acting.
          </p>
        </div>

        <PledgePanel listingId={l.id} priceUsd={l.price_usd ?? 0} priceLabelText={priceLabel(l)} />
      </div>
    </main>
  );
}
