"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { displayName, priceLabel, whereLabel } from "@/lib/data";
import { COLLECTED_KEY } from "@/lib/store";
import { BasketToggle, CollectSeal } from "@/components/Controls";
import { TILE_ATTRIBUTION, TILE_MAX_ZOOM, TILE_URL } from "@/lib/tiles";
import ListingPhoto from "@/components/ListingPhoto";

type StripWindow = { from: number; to: number };

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
  const [tilesOut, setTilesOut] = useState(false);
  const [win, setWin] = useState<StripWindow>({ from: 0, to: 16 });

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const pinsRef = useRef<Record<string, any>>({});
  const stripRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef<string | null>(null);
  const firstFrame = useRef(true);

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

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const stripHeight = useCallback(
    () => Math.round(stripRef.current?.getBoundingClientRect().height ?? 0),
    [],
  );

  /* ---------------------------------------------------------------- the map */

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current) return;
      const map = L.map(mapEl.current, {
        center: [40, -90],
        zoom: 4,
        minZoom: 2,
        maxZoom: 19,
        scrollWheelZoom: true,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
      });
      const tiles = L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: TILE_MAX_ZOOM });
      tiles.on("tileerror", () => setTilesOut(true));
      tiles.addTo(map);
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = { map, L };
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // let the map's own controls know how tall the strip is
  useEffect(() => {
    const measure = () =>
      document.documentElement.style.setProperty("--strip-h", `${stripHeight()}px`);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (observer && stripRef.current) observer.observe(stripRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mapReady, stripHeight]);

  const draw = useCallback(() => {
    const ctx = mapRef.current;
    if (!ctx || !layerRef.current) return;
    const { map, L } = ctx;
    layerRef.current.clearLayers();
    pinsRef.current = {};

    const zoom = map.getZoom();
    mapEl.current?.setAttribute("data-zoom", String(zoom));
    const CELL = zoom <= 4 ? 96 : 64;
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
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker([c.lat, c.lng], { icon, keyboard: false }).addTo(layerRef.current);
      marker.on("click", () => {
        map.setView([c.lat, c.lng], Math.min(zoom + 2, 12), { animate: false });
      });
    }

    for (const l of singles) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="pin-wrap"><i class="pin" data-selected="false" data-country="${l.country}"></i></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const marker = L.marker([l.lat, l.lng], { icon, title: l.name, keyboard: false }).addTo(
        layerRef.current,
      );
      marker.bindPopup(
        () => {
          let isCollected = false;
          try {
            isCollected = (JSON.parse(window.localStorage.getItem(COLLECTED_KEY) ?? "[]") as string[]).includes(l.id);
          } catch {}
          return `<a class="popup" href="/church/${l.id}">
             <img class="popup-photo" src="/api/img/${l.id}?s=card" alt="" />
             <div class="popup-body">
               <div class="popup-name">${escapeHtml(displayName(l))}</div>
               <div class="popup-meta">${escapeHtml(whereLabel(l))}</div>
               <div class="popup-price">${escapeHtml(priceLabel(l))}</div>
               ${isCollected ? '<div class="popup-collected">In your collection</div>' : ""}
             </div>
           </a>`;
        },
        {
          minWidth: 260,
          maxWidth: 300,
          autoPanPaddingTopLeft: [16, 78],
          autoPanPaddingBottomRight: [16, stripHeight() + 16],
        },
      );
      marker.on("click", () => setSelected(l.id));
      pinsRef.current[l.id] = marker;
    }

    // a redraw clears every marker, so put the chosen one back exactly as it was
    const chosen = selectedRef.current;
    if (chosen) {
      const marker = pinsRef.current[chosen];
      if (marker) {
        const el = marker.getElement()?.querySelector(".pin") as HTMLElement | null;
        if (el) el.dataset.selected = "true";
        marker.openPopup();
      }
    }
  }, [rows, stripHeight]);

  useEffect(() => {
    if (!mapReady) return;
    draw();
    const map = mapRef.current?.map;
    if (!map) return;
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
  }, [draw, mapReady]);

  // the opening frame: what can actually be seen between the header and the strip
  useEffect(() => {
    if (!mapReady || !firstFrame.current) return;
    const ctx = mapRef.current;
    if (!ctx) return;
    const { map, L } = ctx;
    const narrow = window.innerWidth < 720;
    const set = narrow ? rows.filter((l) => l.country === "US") : rows;
    if (!set.length) return;
    firstFrame.current = false;
    map.fitBounds(L.latLngBounds(set.map((l) => [l.lat, l.lng] as [number, number])), {
      paddingTopLeft: [18, 78],
      paddingBottomRight: [18, stripHeight() + 14],
      maxZoom: 6,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // frame the results when the search changes
  const lastFrame = useRef<string | null>(null);
  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx || !mapReady) return;
    if (lastFrame.current === q) return;
    lastFrame.current = q;
    if (firstFrame.current) return;
    const { map, L } = ctx;
    const points = rows.map((l) => [l.lat, l.lng] as [number, number]);
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [18, 78],
      paddingBottomRight: [18, stripHeight() + 14],
      maxZoom: points.length === 1 ? 11 : 6,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mapReady]);

  // reflect selection on the map and in the strip
  useEffect(() => {
    const map = mapRef.current?.map;
    if (!map) return;
    for (const [id, marker] of Object.entries(pinsRef.current)) {
      const el = (marker as any).getElement()?.querySelector(".pin") as HTMLElement | null;
      if (el) el.dataset.selected = id === selected ? "true" : "false";
    }
    const chosen = selected ? pinsRef.current[selected] : null;
    if (chosen) {
      map.panTo((chosen as any).getLatLng(), { animate: true });
      (chosen as any).openPopup();
    } else if (selected) {
      // still inside a roundel: go to the building itself, which draws its pin
      const l = listings.find((x) => x.id === selected);
      if (l) map.setView([l.lat, l.lng], Math.max(map.getZoom(), 9), { animate: true });
    }
    const node = stripRef.current?.querySelector(`[data-id="${selected}"]`);
    node?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /* -------------------------------------------------------------- the strip */

  // only the films near the visible window carry a photograph
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    let last = 0;
    const measure = () => {
      const now = performance.now();
      if (now - last < 90) return;
      last = now;
      const first = strip.querySelector<HTMLElement>(".film");
      const step = first ? first.getBoundingClientRect().width + 14 : 240;
      const per = Math.max(1, Math.ceil(strip.clientWidth / step));
      const from = Math.max(0, Math.floor(strip.scrollLeft / step) - 2);
      const to = from + per + 3;
      // once a plate has been asked for, keep it: coming back should not flicker
      for (let i = from; i <= to && i < rows.length; i += 1) seenRef.current.add(rows[i].id);
      setWin((current) => (current.from === from && current.to === to ? current : { from, to }));
    };
    measure();
    strip.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // a slow tick keeps the window honest even where scroll events are throttled
    const tick = window.setInterval(measure, 400);
    return () => {
      strip.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.clearInterval(tick);
    };
  }, [rows]);

  return (
    <section className="atlas map-home" id="atlas">
      <div className="map" ref={mapEl} />

      <div className="strip-head">
        The register · {rows.length.toLocaleString("en-US")}{" "}
        {rows.length === 1 ? "building" : "buildings"}
      </div>

      <div className="filmstrip" ref={stripRef}>
        {rows.map((l, i) => (
          <button
            type="button"
            key={l.id}
            className="film"
            data-id={l.id}
            data-selected={selected === l.id}
            onClick={() => setSelected(l.id)}
            aria-label={`${displayName(l)}, ${priceLabel(l)}`}
          >
            <ListingPhoto
              id={l.id}
              alt=""
              size="card"
              className="film-photo"
              near={seenRef.current.has(l.id) || (i >= win.from && i <= win.to)}
            />
            <span className="film-caption">
              <span className="film-name">{displayName(l)}</span>
              <span className="film-price">{priceLabel(l)}</span>
            </span>
          </button>
        ))}
      </div>

      {tilesOut && (
        <div className="tile-note">Map tiles unavailable · the atlas still holds every building</div>
      )}

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
            <ListingPhoto id={selectedListing.id} alt={displayName(selectedListing)} size="card" near />
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
    </section>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
