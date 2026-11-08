export type Country = "US" | "GB" | "FR" | string;

export type Listing = {
  id: string;
  name: string;
  address: string;
  city: string;
  /** US rows carry a two-letter state code; UK and European rows carry the county / département. */
  state?: string;
  region?: string;
  zip?: string | null;
  country: Country;
  currency: string;
  /** Asking price in the seller's own currency. Null means "offers invited". */
  price_local: number | null;
  /** Converted for sorting and totals; the rate used is in data/fx.json. */
  price_usd: number | null;
  grade?: string | null;
  status?: string;
  lat: number;
  lng: number;
  description: string;
  source: string;
  source_url: string;
  source_id: string;
  contact?: string | null;
  contact_url?: string | null;
  rank: number;
};

export type PledgeAggregate = {
  listingId: string;
  count: number;
  totalCents: number;
  recent: { name: string; amountCents: number; at: string }[];
};
