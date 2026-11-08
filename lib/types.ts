export type Listing = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  lat: number;
  lng: number;
  price_usd: number;
  description: string;
  source: string;
  source_url: string;
  source_id: string;
  contact: string | null;
  rank: number;
};

export type PledgeAggregate = {
  listingId: string;
  count: number;
  totalCents: number;
  recent: { name: string; amountCents: number; at: string }[];
};
