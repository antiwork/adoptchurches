"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { displayName, priceLabel, whereLabel } from "@/lib/data";
import { COLLECTED_KEY } from "@/lib/store";
import { BasketToggle, CollectSeal } from "@/components/Controls";
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from "@/lib/tiles";
import ListingPhoto from "@/components/ListingPhoto";

/**
 * The home page is the map. No register panel, no filter rail: a wide sheet of
 * country with every building on it, and a strip of photographs along the
 * bottom to browse by eye. Text is kept to the name and the price.
 */
export default function Atlas({ listings }: { listings: Listing[] }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searching, setSearching] = useState(false);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pinsRef = useRef<Record<string, any>>({});
  const stripRef = useRef<HTMLDivElement | null>(null);
  const firstDraw = useRef(true);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return listings;
    return listings.filter((l) =>
      `${l.name} ${l.city} ${l.region ?? ""} ${l.state ?? ""} ${l.address}`
        .toLowerCase()
        .includes(needle),
    );
  }, [listings, q]);

  const selectedListing = useMemo(
    () => (selected ? listings.find((l) => l.id === selected) ?? null : null),
    [selected, listings],
  );

  // boot the map once: the country, full screen
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current) return;
      const map = L.map(mapEl.current, {
        // the whole register in one frame: the eastern states, England, and France
        center: [46, -22],
        zoom: 3,
        minZoom: 3,
        maxZoom: 19,
        scrollWheelZoom: true,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
      });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: TILE_MAX_ZOOM }).addTo(map);
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
          return `<a class="popup" href="/church/${l.id}">
             <img class="popup-photo" src="/api/img/${l.id}?s=card" alt="" loading="lazy" />
             <div class="popup-body">
               <div class="popup-name">${escapeHtml(displayName(l))}</div>
               <div class="popup-meta">${escapeHtml(whereLabel(l))}</div>
               <div class="popup-price">${escapeHtml(priceLabel(l))}</div>
               ${isCollected ? '<div class="popup-collected">In your collection</div>' : ""}
             </div>
           </a>`;
        });
        marker.on("click", () => setSelected(l.id));
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

    return () => {
      map.off("zoomend", onMove);
      map.off("moveend", onMove);
      if (timer) clearTimeout(timer);
    };
  }, [rows, mapReady]);

  // frame the results when the search changes
  const lastFrame = useRef<string | null>(null);
  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx || !mapReady) return;
    if (lastFrame.current === q) return;
    lastFrame.current = q;
    const { map, L } = ctx;
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    const points = rows.map((l) => [l.lat, l.lng] as [number, number]);
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: points.length === 1 ? 11 : 6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mapReady]);

  // reflect selection on the map and in the strip
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
    const node = stripRef.current?.querySelector(`[data-id="${selected}"]`);
    node?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <section className="atlas map-home" id="atlas">
      <div className="map" ref={mapEl} />

      <div className="map-search" data-open={searching}>
        <button
          type="button"
          className="map-search-toggle"
          aria-label="Search the register"
          aria-expanded={searching}
          onClick={() => setSearching((v) => !v)}
        >
          Search
        </button>
        {searching && (
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Town, county, or name"
            aria-label="Search the register"
          />
        )}
      </div>

      {selectedListing && (
        <div className="map-card">
          <Link href={`/church/${selectedListing.id}`} className="map-card-photo">
            <ListingPhoto id={selectedListing.id} alt={displayName(selectedListing)} size="card" />
          </Link>
          <div className="map-card-text">
            <Link href={`/church/${selectedListing.id}`} className="map-card-name">
              {displayName(selectedListing)}
            </Link>
            <div className="map-card-where">{whereLabel(selectedListing)}</div>
            <div className="map-card-price">{priceLabel(selectedListing)}</div>
            <div className="map-card-actions">
              <CollectSeal id={selectedListing.id} name={displayName(selectedListing)} />
              <BasketToggle id={selectedListing.id} name={displayName(selectedListing)} />
            </div>
          </div>
          <button
            type="button"
            className="map-card-close"
            aria-label="Close"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="strip-head">
        The register · {rows.length.toLocaleString("en-US")} buildings
      </div>

      <div className="filmstrip" ref={stripRef} role="list">
        {rows.map((l) => (
          <button
            type="button"
            key={l.id}
            role="listitem"
            className="film"
            data-id={l.id}
            data-selected={selected === l.id}
            onClick={() => setSelected(l.id)}
            aria-label={`${displayName(l)}, ${priceLabel(l)}`}
          >
            <ListingPhoto id={l.id} alt="" size="card" />
            <span className="film-caption">
              <span className="film-name">{displayName(l)}</span>
              <span className="film-price">{priceLabel(l)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
