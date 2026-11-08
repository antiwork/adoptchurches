"use client";

// Client-side state for the collection, the basket and past receipts.
// Everything lives in localStorage; a custom event keeps every component
// on the page in agreement. No server is consulted.

import { useSyncExternalStore } from "react";

export const COLLECTED_KEY = "adoptchurches:collected";
export const BASKET_KEY = "adoptchurches:basket";
export const RECEIPTS_KEY = "adoptchurches:receipts";

const CHANGE_EVENT = "adoptchurches:store";

export type BasketLine = { id: string; qty: number };

export type Receipt = {
  serial: string;
  at: string; // ISO timestamp
  name: string;
  email: string;
  town?: string;
  note?: string;
  lines: { id: string; name: string; where: string; priceUsd: number | null; priceLabel: string }[];
  subtotalUsd: number;
  reserveUsd: number;
  totalUsd: number;
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable; the page still works for the session
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// ---- collected ----

let collectedCache: string[] = [];
let collectedRaw: string | null = null;

function getCollectedSnapshot(): string[] {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(COLLECTED_KEY);
  if (raw !== collectedRaw) {
    collectedRaw = raw;
    collectedCache = read<string[]>(COLLECTED_KEY, []);
  }
  return collectedCache;
}

const EMPTY: never[] = [];

export function useCollected(): string[] {
  return useSyncExternalStore(subscribe, getCollectedSnapshot, () => EMPTY);
}

export function toggleCollected(id: string) {
  const cur = read<string[]>(COLLECTED_KEY, []);
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  write(COLLECTED_KEY, next);
}

// ---- basket ----

let basketCache: BasketLine[] = [];
let basketRaw: string | null = null;

function getBasketSnapshot(): BasketLine[] {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(BASKET_KEY);
  if (raw !== basketRaw) {
    basketRaw = raw;
    basketCache = read<BasketLine[]>(BASKET_KEY, []);
  }
  return basketCache;
}

export function useBasket(): BasketLine[] {
  return useSyncExternalStore(subscribe, getBasketSnapshot, () => EMPTY);
}

export function addToBasket(id: string) {
  const cur = read<BasketLine[]>(BASKET_KEY, []);
  if (cur.some((l) => l.id === id)) return;
  write(BASKET_KEY, [...cur, { id, qty: 1 }]);
}

export function removeFromBasket(id: string) {
  const cur = read<BasketLine[]>(BASKET_KEY, []);
  write(BASKET_KEY, cur.filter((l) => l.id !== id));
}

export function toggleBasket(id: string) {
  const cur = read<BasketLine[]>(BASKET_KEY, []);
  if (cur.some((l) => l.id === id)) {
    write(BASKET_KEY, cur.filter((l) => l.id !== id));
  } else {
    write(BASKET_KEY, [...cur, { id, qty: 1 }]);
  }
}

export function emptyBasket() {
  write(BASKET_KEY, []);
}

// ---- receipts ----

let receiptsCache: Receipt[] = [];
let receiptsRaw: string | null = null;

function getReceiptsSnapshot(): Receipt[] {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(RECEIPTS_KEY);
  if (raw !== receiptsRaw) {
    receiptsRaw = raw;
    receiptsCache = read<Receipt[]>(RECEIPTS_KEY, []);
  }
  return receiptsCache;
}

export function useReceipts(): Receipt[] {
  return useSyncExternalStore(subscribe, getReceiptsSnapshot, () => EMPTY);
}

export function saveReceipt(r: Receipt) {
  const cur = read<Receipt[]>(RECEIPTS_KEY, []);
  write(RECEIPTS_KEY, [r, ...cur]);
}

// A serial in the manner of a ledger: letters from a hash of the ids,
// figures from the clock. Stable for a given order and moment.
export function makeSerial(ids: string[], at: Date): string {
  const basis = ids.slice().sort().join("|");
  let h = 5381;
  for (let i = 0; i < basis.length; i++) {
    h = ((h << 5) + h + basis.charCodeAt(i)) >>> 0;
  }
  const letters = "ABCDEFGHJKLMNPQRSTVWXYZ";
  const a = letters[h % letters.length];
  const b = letters[Math.floor(h / 23) % letters.length];
  const num = (h % 9000) + 1000;
  const day =
    at.getUTCFullYear().toString().slice(2) +
    String(at.getUTCMonth() + 1).padStart(2, "0") +
    String(at.getUTCDate()).padStart(2, "0");
  return `No. ${a}${b} ${num}-${day}`;
}
