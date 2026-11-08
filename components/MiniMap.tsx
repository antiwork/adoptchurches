"use client";

import { useEffect, useRef } from "react";

export default function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const el = useRef<HTMLDivElement | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (!el.current || booted.current) return;
    booted.current = true;
    let map: any;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!el.current) return;
      map = L.map(el.current, {
        center: [lat, lng],
        zoom: 13,
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      L.marker([lat, lng], {
        icon: L.divIcon({ className: "", html: '<div class="pin" data-selected="true"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
        title: label,
      }).addTo(map);
    })();
    return () => {
      map?.remove?.();
    };
  }, [lat, lng, label]);

  return <div className="mini-map" ref={el} aria-label={`Map of ${label}`} />;
}
