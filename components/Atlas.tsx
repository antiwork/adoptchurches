"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import {
  countryName,
  displayName,
  distanceLabel,
  milesFrom,
  priceLabel,
  usdApprox,
  whereLabel,
} from "@/lib/data";
import { COLLECTED_KEY, useCollected } from "@/lib/store";
import { BasketToggle, CollectSeal } from "@/components/Controls";
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from "@/lib/tiles";
import ListingPhoto from "@/components/ListingPhoto";

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
  const [collectedOnly, setCollectedOnly] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [aggs, setAggs] = useState<Record<string, Agg>>({});
  const [mapReady, setMapReady] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const collected = useCollected();

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pinsRef = useRef<Record<string, any>>({});
  const drawRef = useRef<null | (() => void)>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const firstDraw = useRef(true);

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
      if (collectedOnly && !collected.includes(l.id)) return false;
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
  }, [listings, q, band, country, origin, collectedOnly, collected]);

  const selectedListing = useMemo(
    () => (selected ? listings.find((l) => l.id === selected) ?? null : null),
    [selected, listings],
  );

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

  // boot the map once: the continental United States, full screen
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current) return;
      const map = L.map(mapEl.current, {
        center: [39.5, -98.35],
        zoom: 4,
        maxZoom: 19,
        scrollWheelZoom: true,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
      });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: TILE_MAX_ZOOM,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = { map, L };
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // draw pins for the current view, grouped into brass roundels when the view is wide
  useEffect(() => {
    if (!mapReady) return;
    const ctx = mapRef.current;
    if (!ctx) return;
    const { map, L } = ctx;

    const draw = () => {
      if (!layerRef.current) return;
      layerRef.current.clearLayers();
      pinsRef.current = {};

      const zoom = map.getZoom();
      mapEl.current?.setAttribute("data-zoom", String(zoom));
      const CELL = 64;
      const clusters = new Map<string, { lat: number; lng: number; items: typeof rows }>();
      const singles: typeof rows = [];

      if (zoom <= 6) {
        for (const l of rows) {
          const pt = map.project([l.lat, l.lng], zoom);
          const key = `${Math.floor(pt.x / CELL)}:${Math.floor(pt.y / CELL)}`;
          const bucket = clusters.get(key);
          if (bucket) bucket.items.push(l);
          else clusters.set(key, { lat: l.lat, lng: l.lng, items: [l] });
        }
        for (const c of clusters.values()) if (c.items.length < 3) singles.push(...c.items);
      } else {
        singles.push(...rows);
      }

      for (const c of clusters.values()) {
        if (c.items.length < 3) continue;
        const icon = L.divIcon({
          className: "",
          html: `<div class="cluster" title="${c.items.length} buildings">${c.items.length}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const marker = L.marker([c.lat, c.lng], { icon }).addTo(layerRef.current);
        marker.on("click", () => {
          map.setView([c.lat, c.lng], Math.min(zoom + 2, 12), { animate: false });
        });
      }

      for (const l of singles) {
        const icon = L.divIcon({
          className: "",
          html: `<div class="pin" data-selected="false" data-country="${l.country}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const marker = L.marker([l.lat, l.lng], { icon, title: l.name }).addTo(layerRef.current);
        marker.bindPopup(() => {
          let isCollected = false;
          try {
            isCollected = (JSON.parse(window.localStorage.getItem(COLLECTED_KEY) ?? "[]") as string[]).includes(l.id);
          } catch {}
          return `<div class="popup-name">${escapeHtml(l.name)}</div>
           <div class="popup-meta">${escapeHtml(whereLabel(l))}</div>
           <div class="popup-price">${escapeHtml(priceLabel(l))}</div>${
             isCollected ? '<div class="popup-collected">In your collection</div>' : ""
           }`;
        });
        marker.on("click", () => setSelected(l.id));
        marker.on("dblclick", () => {
          window.location.href = `/church/${l.id}`;
        });
        pinsRef.current[l.id] = marker;
      }
    };

    draw();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onMove = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(draw, 180);
    };
    map.on("zoomend", onMove);
    map.on("moveend", onMove);
    drawRef.current = draw;

    return () => {
      map.off("zoomend", onMove);
      map.off("moveend", onMove);
      if (timer) clearTimeout(timer);
    };
  }, [rows, mapReady]);

  // frame the results when the filters change, without fighting the cluster redraw
  const frameKey = `${country}|${band}|${q}|${collectedOnly ? 1 : 0}`;
  const lastFrame = useRef<string | null>(null);
  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx || !mapReady) return;
    if (lastFrame.current === frameKey) return;
    lastFrame.current = frameKey;
    const { map, L } = ctx;
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    const points = rows.map((l) => [l.lat, l.lng] as [number, number]);
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    const maxZoom = points.length === 1 ? 11 : country === "all" ? 5 : 8;
    map.fitBounds(bounds, { padding: [60, 60], maxZoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, mapReady]);

  // reflect selection on the map + list
  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx) return;
    const { map } = ctx;
    for (const [id, marker] of Object.entries(pinsRef.current)) {
      const el = (marker as any).getElement()?.querySelector(".pin") as HTMLElement | null;
      if (el) el.dataset.selected = id === selected ? "true" : "false";
      if (id === selected) {
        map.panTo((marker as any).getLatLng(), { animate: true });
        (marker as any).openPopup();
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
    <section className="atlas map-home" id="atlas">
      <div className="map" ref={mapEl} />

      <div className="dock" data-open={sheetOpen}>
        <button
          type="button"
          className="dock-handle"
          aria-expanded={sheetOpen}
          aria-controls="dock-body"
          onClick={() => setSheetOpen((v) => !v)}
        >
          <span className="dock-handle-bar" aria-hidden="true" />
          <span className="dock-handle-text">
            {listings.length} buildings · tap to browse
          </span>
        </button>

        <div className="dock-body" id="dock-body">
          <div className="dock-head">
            <span className="eyebrow">The register</span>
            <h2>{rows.length.toLocaleString("en-US")} offered</h2>
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
          </div>

          <div className="controls bands">
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
            <button
              className="chip small collected-chip"
              data-on={collectedOnly}
              onClick={() => setCollectedOnly((v) => !v)}
              aria-pressed={collectedOnly}
            >
              Collected · <span data-collect-count>{collected.length}</span>
            </button>
          </div>

          <div className="controls tools">
            <button type="button" className="footnote-link" onClick={locate} disabled={locating}>
              {locating ? "Finding your position" : origin ? "Recentre on me" : "Sort by distance"}
            </button>
          </div>

          {selectedListing && (
            <div className="entry-plate" data-id={selectedListing.id}>
              <div className="entry-plate-top">
                <div>
                  <div className="entry-plate-name">{displayName(selectedListing)}</div>
                  <div className="entry-plate-where">{whereLabel(selectedListing)}</div>
                </div>
                <div className="entry-plate-price">{priceLabel(selectedListing)}</div>
              </div>
              <div className="entry-plate-actions">
                <CollectSeal id={selectedListing.id} name={displayName(selectedListing)} />
                <BasketToggle id={selectedListing.id} name={displayName(selectedListing)} />
                <Link href={`/church/${selectedListing.id}`} className="entry-plate-link">
                  Particulars
                </Link>
              </div>
            </div>
          )}

          <div className="list" ref={listRef}>
            {rows.length === 0 && (
              <div className="empty">
                {collectedOnly
                  ? "Nothing is collected yet. Press a seal to begin."
                  : "No entry answers that description. Try a wider price band."}
              </div>
            )}
            {rows.map((l) => {
              const agg = aggs[l.id];
              const approx = usdApprox(l);
              return (
                <div
                  key={l.id}
                  className="card"
                  data-id={l.id}
                  data-selected={selected === l.id}
                  onClick={() => setSelected(l.id)}
                >
                  <ListingPhoto id={l.id} alt={displayName(l)} size="card" />
                  <div>
                    <div className="name">
                      <Link href={`/church/${l.id}`}>{displayName(l)}</Link>
                    </div>
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
                    <div className="row-actions">
                      <CollectSeal id={l.id} name={displayName(l)} />
                      <BasketToggle id={l.id} name={displayName(l)} />
                    </div>
                  </div>
                  <div className="right">
                    <div className="price">{priceLabel(l)}</div>
                    {approx && <div className="meta">{approx}</div>}
                    {origin && <div className="dist">{distanceLabel(milesFrom(origin, l))}</div>}
                  </div>
                </div>
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
