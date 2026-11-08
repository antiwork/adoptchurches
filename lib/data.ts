import listingsJson from "@/data/listings.json";
import type { Listing } from "./types";

export const listings: Listing[] = listingsJson as Listing[];

export function getListing(id: string): Listing | undefined {
  return listings.find((l) => l.id === id);
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

export function stateCount(): number {
  return new Set(listings.map((l) => l.state)).size;
}

export function totalAsking(): number {
  return listings.reduce((sum, l) => sum + l.price_usd, 0);
}
