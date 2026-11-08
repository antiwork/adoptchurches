"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { countryName, displayName, distanceLabel, milesFrom, priceLabel, usdApprox, whereLabel } from "@/lib/data";

type Band = "all" | "under250" | "mid" | "over1m";
type CountryFilter = "all" | "US" | "GB" | "FR";

const BANDS: { id: Band; label: string; test: (p: number | null) => boolean }[] = [
  { id: "all", label: "Every price", test: () => true },
  { id: "under250", label: "Under $250k", test: (p) => p != null && p < 250_000 },
  { id: "mid", label: "$250k – $1M", test: (p) => p != null && p >= 250_000 && p < 1_000_000 },
  { id: "over1m", label: "$1M and up", test: (p) => p != null && p >= 1_000_000 },
];

type Agg = { count: number; totalCents: number };

export default function Atlas({ listings }: { listings: Listing[] }) {
  const [q, setQ] = useState("");
  const [band, setBand] = useState<Band>("all");
  const [country, setCountry] = useState<CountryFilter>("all");
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

  const countries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of listings) counts[l.country] = (counts[l.country] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [listings]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = listings.filter((l) => {
      if (country !== "all" && l.country !== country) return false;
      if (!BANDS.find((b) => b.id === band)!.test(l.price_usd)) return false;
      if (!needle) return true;
      return `${l.name} ${l.city} ${l.region ?? ""} ${l.state ?? ""} ${l.address} ${countryName(l.country)}`
        .toLowerCase()
        .includes(needle);
    });
    if (!origin) return filtered;
    return filtered
      .map((l) => ({ l, d: milesFrom(origin, l) }))
      .sort((a, b) => a.d - b.d)
      .map(({ l }) => l);
  }, [listings, q, band, country, origin]);

  // load pledge counts so entries can note them
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
        center: [45, -25],
        zoom: 3,
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
        worldCopyJump: true,
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
    for (const l of rows.slice(0, 500)) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin" data-selected="false" data-country="${l.country}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([l.lat, l.lng], { icon, title: l.name }).addTo(layerRef.current);
      marker.bindPopup(
        `<div class="popup-name">${escapeHtml(l.name)}</div>
         <div class="popup-meta">${escapeHtml(whereLabel(l))}</div>
         <div class="popup-price">${escapeHtml(priceLabel(l))}</div>`,
      );
      marker.on("click", () => setSelected(l.id));
      pinsRef.current[l.id] = marker;
      points.push([l.lat, l.lng]);
    }
    if (points.length) {
      const bounds = L.latLngBounds(points);
      const maxZoom = points.length === 1 ? 11 : country === "all" ? 5 : 8;
      map.fitBounds(bounds, { padding: [50, 50], maxZoom });
    }
  }, [rows, mapReady, country]);

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
          <div className="eyebrow">The atlas</div>
          <h2>{rows.length.toLocaleString("en-US")} buildings presently offered</h2>
          <div className="atlas-tools">
            <button className="btn" onClick={locate} disabled={locating}>
              {locating ? "Finding your position" : origin ? "Recentre on me" : "Sort by distance"}
            </button>
          </div>
        </div>

        <div className="controls">
          <label className="field">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by town, county, or name"
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

        <div className="controls countries">
          <button
            className="chip small"
            data-on={country === "all"}
            onClick={() => setCountry("all")}
            aria-pressed={country === "all"}
          >
            Everywhere · {listings.length}
          </button>
          {countries.map(([code, n]) => (
            <button
              key={code}
              className="chip small"
              data-on={country === code}
              onClick={() => setCountry(code as CountryFilter)}
              aria-pressed={country === code}
            >
              {countryName(code)} · {n}
            </button>
          ))}
        </div>

        <div className="atlas-body">
          <div className="map-wrap">
            <div className="map-frame">
              <div className="map" ref={mapEl} />
            </div>
            <div className="plate-caption">Plate I · the atlas</div>
            <div className="map-hint">
              {origin
                ? "Entries are ordered from your position. Select a pin to read an entry."
                : `Select a pin to open its entry.${rows.length > 500 ? ` Pins show the first 500 of ${rows.length}.` : ""}`}
            </div>
          </div>

          <div className="list" ref={listRef}>
            {rows.length === 0 && (
              <div className="empty">No entry answers that description. Try a wider price band.</div>
            )}
            {rows.map((l) => {
              const agg = aggs[l.id];
              const approx = usdApprox(l);
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
                  <div>
                    <div className="name">{displayName(l)}</div>
                    <div className="where">
                      {whereLabel(l)}
                      {l.grade ? ` · ${l.grade}` : ""}
                    </div>
                    {(agg?.count ?? 0) > 0 || l.status === "Under offer" ? (
                      <div className="meta">
                        {agg && agg.count > 0
                          ? `${agg.count} ${agg.count === 1 ? "pledge" : "pledges"} entered`
                          : "Under offer"}
                      </div>
                    ) : null}
                  </div>
                  <div className="right">
                    <div className="price">{priceLabel(l)}</div>
                    {approx && <div className="meta">{approx}</div>}
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
