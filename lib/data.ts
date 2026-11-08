import listingsJson from "@/data/listings.json";
import fxJson from "@/data/fx.json";
import type { Listing } from "./types";

export const listings: Listing[] = listingsJson as Listing[];
export const fx = fxJson as { usdPer: Record<string, number>; asOf: string };

export function getListing(id: string): Listing | undefined {
  return listings.find((l) => l.id === id);
}

/** Format an amount of money in a given currency (no minor units: these are buildings). */
export function fmt(amount: number, currency = "USD"): string {
  const locale = currency === "GBP" ? "en-GB" : "en-US";
  return amount.toLocaleString(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

/** The headline price for a building: local currency, or "Offers invited". */
export function priceLabel(l: Pick<Listing, "price_local" | "currency" | "price_usd">): string {
  if (l.price_local == null) return "Offers invited";
  return fmt(l.price_local, l.currency);
}

/** A short "$1.3M" style figure for the approximate USD value of a non-US price. */
export function usdApprox(l: Pick<Listing, "price_usd" | "currency">): string | null {
  if (l.price_usd == null || l.currency === "USD") return null;
  if (l.price_usd >= 1_000_000) return `≈ $${(l.price_usd / 1_000_000).toFixed(1)}M`;
  return `≈ $${Math.round(l.price_usd / 1000)}k`;
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function milesFrom(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceLabel(miles: number): string {
  if (miles < 1) return "under a mile";
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles).toLocaleString("en-US")} mi away`;
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "England",
  FR: "France",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

/** Where a building is, in the form each country uses. */

const REGION_NAMES: Record<string, string> = {
  aquitaine: "Aquitaine",
  auvergne: "Auvergne",
  "basse-normandie": "Basse-Normandie",
  "centre-val-de-loire": "Centre-Val de Loire",
  "franche-comte": "Franche-Comt\u00e9",
  "haute-normandie": "Haute-Normandie",
  "ile-de-france": "\u00cele-de-France",
  lorraine: "Lorraine",
  "midi-pyrenees": "Midi-Pyr\u00e9n\u00e9es",
  "nord-pas-de-calais": "Nord-Pas-de-Calais",
  paca: "Provence-Alpes-C\u00f4te d'Azur",
  "pays-de-loire": "Pays de la Loire",
  picardie: "Picardie",
  "poitou-charentes": "Poitou-Charentes",
  "rhones-alpes": "Rh\u00f4ne-Alpes",
};

const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "et", "sur", "sous", "en", "of"]);

export function titleCase(input: string): string {
  const known = REGION_NAMES[input.toLowerCase().trim()];
  if (known) return known;
  const words = input.split(/(\s+|[-/])/);
  let first = true;
  return words
    .map((w) => {
      if (/^[\s\-/]$/.test(w)) return w;
      if (!w) return w;
      if (/^[A-Z]{2}$/.test(w)) return w; // PA, NY, UK
      if (/^[A-Z]{3,}$/.test(w)) return w[0] + w.slice(1).toLowerCase(); // CHER -> Cher
      const lower = w.toLowerCase();
      if (!first && SMALL_WORDS.has(lower)) return lower;
      first = false;
      return w[0].toUpperCase() + w.slice(1);
    })
    .join("");
}

const BUILDING_TYPE =
  /\b(église|eglise|chapelle|abbaye|prieuré|prieure|monastère|monastere|couvent|temple|church|chapel|meeting house|synagogue|mosque)\b/i;

// Seller headlines ("Au coeur d'un village ... une ancienne chapelle ...") are long.
// An entry in a printed register is titled plainly: type and place.
export function displayName(l: Pick<Listing, "name" | "city" | "region" | "state" | "country">): string {
  if (l.name.length <= 58) return l.name;
  const qualified = l.name.match(
    new RegExp(`\\b(ancienne?|former|ex-)\\s+([^,.;]{0,26}?)\\b(${BUILDING_TYPE.source.slice(2, -2)})\\b`, "i"),
  );
  const typeMatch = l.name.match(BUILDING_TYPE);
  if (qualified) {
    const q = qualified[1].toLowerCase();
    const t = qualified[3].toLowerCase();
    return `${q[0].toUpperCase()}${q.slice(1)} ${t}, ${l.city}`;
  }
  if (typeMatch) return `${titleCase(typeMatch[1].toLowerCase())}, ${l.city}`;
  return `${l.city}, ${titleCase(l.region ?? l.state ?? countryName(l.country))}`;
}

// Harvested addresses arrive in the seller's casing: "Sancerre, CHER, centre-val-de-loire, France".
export function displayAddress(l: Pick<Listing, "address" | "city" | "country">): string {
  const parts = l.address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/^[0-9]/.test(p) ? p : titleCase(p)));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.join(", ");
}

export function whereLabel(l: Pick<Listing, "city" | "state" | "region" | "country">): string {
  if (l.country === "US") return `${l.city}, ${l.state ?? l.region ?? ""}`.replace(/,\s*$/, "");
  if (l.country === "GB") return `${l.city}, ${l.region ?? "England"}`.replace(/,\s*$/, "");
  const region = l.region ? titleCase(l.region) : countryName(l.country);
  return `${l.city}, ${region}`.replace(/,\s*$/, "");
}

export function countryCount(): number {
  return new Set(listings.map((l) => l.country)).size;
}

export function stateCount(): number {
  return new Set(listings.filter((l) => l.country === "US").map((l) => l.state)).size;
}

export function totalAsking(): number {
  return listings.reduce((sum, l) => sum + (l.price_usd ?? 0), 0);
}

export function pricedCount(): number {
  return listings.filter((l) => l.price_usd != null).length;
}
