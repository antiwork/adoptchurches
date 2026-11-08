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
export function whereLabel(l: Pick<Listing, "city" | "state" | "region" | "country">): string {
  if (l.country === "US") return `${l.city}, ${l.state ?? l.region ?? ""}`.replace(/,\s*$/, "");
  if (l.country === "GB") return `${l.city}, ${l.region ?? "England"}`.replace(/,\s*$/, "");
  return `${l.city}, ${l.region ?? countryName(l.country)}`.replace(/,\s*$/, "");
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
