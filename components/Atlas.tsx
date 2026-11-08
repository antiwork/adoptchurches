"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { distanceLabel, milesFrom, money } from "@/lib/data";

type Band = "all" | "under250" | "mid" | "over1m";

const BANDS: { id: Band; label: string; test: (p: number) => boolean }[] = [
  { id: "all", label: "Every price", test: () => true },
  { id: "under250", label: "Under $250k", test: (p) => p < 250_000 },
  { id: "mid", label: "$250k – $1M", test: (p) => p >= 250_000 && p < 1_000_000 },
  { id: "over1m", label: "$1M and up", test: (p) => p >= 1_000_000 },
];

type Agg = { count: number; totalCents: number };

export default function Atlas({ listings }: { listings: Listing[] }) {
  const [q, setQ] = useState("");
  const [band, setBand] = useState<Band>("all");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [aggs, setAggs] = useState<Record<string, Agg>>({});
  const [mapReady, setMapReady] = useState(false);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pinsRef = useRef<Record<string, any>>({});
  const listRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (!BANDS.find((b) => b.id === band)!.test(l.price_usd)) return false;
      if (!needle) return true;
      return `${l.name} ${l.city} ${l.state} ${l.address}`.toLowerCase().includes(needle);
    });
    if (!origin) return filtered;
    return filtered
      .map((l) => ({ l, d: milesFrom(origin, l) }))
      .sort((a, b) => a.d - b.d)
      .map(({ l }) => l);
  }, [listings, q, band, origin]);

  // load pledges so cards can show progress
  useEffect(() => {
    let alive = true;
    fetch("/api/pledges")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (!alive) return;
        const next: Record<string, Agg> = {};
        for (const [id, v] of Object.entries<any>(data ?? {})) {
          next[id] = { count: v.count ?? 0, totalCents: v.totalCents ?? 0 };
        }
        setAggs(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // boot the map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current) return;
      const map = L.map(mapEl.current, {
        center: [39.5, -98.35],
        zoom: 4,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = { map, L };
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // draw pins for the current view
  useEffect(() => {
    if (!mapReady) return;
    const ctx = mapRef.current;
    if (!ctx) return;
    const { map, L } = ctx;
    layerRef.current.clearLayers();
    pinsRef.current = {};
    const points: [number, number][] = [];
    for (const l of rows.slice(0, 400)) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin" data-selected="false"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([l.lat, l.lng], { icon, title: l.name }).addTo(layerRef.current);
      marker.bindPopup(
        `<div class="popup-name">${escapeHtml(l.name)}</div>
         <div class="popup-meta">${escapeHtml(l.city)}, ${escapeHtml(l.state)}</div>
         <div class="popup-price">${money(l.price_usd * 100)}</div>`,
      );
      marker.on("click", () => setSelected(l.id));
      pinsRef.current[l.id] = marker;
      points.push([l.lat, l.lng]);
    }
    if (points.length && !origin) map.fitBounds(points as any, { padding: [40, 40], maxZoom: 6 });
  }, [rows, origin, mapReady]);

  // reflect selection on the map + list
  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx) return;
    const { map } = ctx;
    for (const [id, marker] of Object.entries(pinsRef.current)) {
      const el = marker.getElement()?.querySelector(".pin") as HTMLElement | null;
      if (el) el.dataset.selected = id === selected ? "true" : "false";
      if (id === selected) {
        map.panTo(marker.getLatLng(), { animate: true });
        marker.openPopup();
      }
    }
    const node = listRef.current?.querySelector(`[data-id="${selected}"]`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(next);
        setLocating(false);
        const map = mapRef.current?.map;
        if (map) map.setView([next.lat, next.lng], 8, { animate: true });
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  }

  return (
    <section className="atlas" id="atlas">
      <div className="shell">
        <div className="atlas-head">
          <div>
            <div className="eyebrow">The atlas</div>
            <h2>{rows.length.toLocaleString("en-US")} buildings on the market right now</h2>
          </div>
          <button className="btn ghost" onClick={locate} disabled={locating}>
            {locating ? "Finding you…" : origin ? "Recentre on me" : "Sort by distance"}
          </button>
        </div>

        <div className="controls">
          <label className="field">
            <SearchIcon />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a town, state, or a name"
              aria-label="Search listings"
            />
          </label>
          {BANDS.map((b) => (
            <button
              key={b.id}
              className="chip"
              data-on={band === b.id}
              onClick={() => setBand(b.id)}
              aria-pressed={band === b.id}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="atlas-body">
          <div className="map-wrap">
            <div className="map-hint">
              {origin
                ? "Sorted from your location. Click a pin to read about the building."
                : "Scroll to zoom is off so the page still scrolls. Click a pin, or use “Sort by distance”."}
            </div>
            <div className="map" ref={mapEl} />
          </div>

          <div className="list" ref={listRef}>
            {rows.length === 0 && <div className="empty">Nothing matches that yet. Try a wider price band.</div>}
            {rows.map((l, i) => {
              const agg = aggs[l.id];
              const pct = agg ? Math.min(100, (agg.totalCents / (l.price_usd * 100)) * 100) : 0;
              return (
                <Link
                  key={l.id}
                  href={`/church/${l.id}`}
                  className="card"
                  data-id={l.id}
                  data-selected={selected === l.id}
                  onMouseEnter={() => setSelected(l.id)}
                  onFocus={() => setSelected(l.id)}
                >
                  <div className="rank">{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="name">{l.name}</div>
                    <div className="where">
                      {l.city}, {l.state}
                    </div>
                    <div className="bar">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    <div className="bar-meta">
                      <span>{agg && agg.count > 0 ? `${agg.count} pledged · ${money(agg.totalCents)}` : "No pledges yet"}</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                  </div>
                  <div className="right">
                    <div className="price">{money(l.price_usd * 100)}</div>
                    {origin && <div className="dist">{distanceLabel(milesFrom(origin, l))}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
