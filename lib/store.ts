"use client";

// What a reader keeps for themselves: the buildings they have collected.
// Nothing here is a purchase. There is no basket, no cart and no order form —
// the register records interest and pledges, and money never moves through it.

import { useSyncExternalStore } from "react";

export const COLLECTED_KEY = "adoptchurches:collected";

const CHANGE_EVENT = "adoptchurches:store";
const SESSION_KEY = "adoptchurches:session";

/** A stable, anonymous id so interest can be counted without cookies or accounts. */
function sessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Tell the register that a building was collected or looked at. Fire and forget:
 * a failed beacon must never interrupt the page.
 */
export function trackEvent(kind: "collect" | "uncollect" | "view", listingId: string) {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, listingId, sessionId: sessionId() }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // nothing to do
  }
}

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
  const had = cur.includes(id);
  const next = had ? cur.filter((x) => x !== id) : [...cur, id];
  write(COLLECTED_KEY, next);
  trackEvent(had ? "uncollect" : "collect", id);
}
