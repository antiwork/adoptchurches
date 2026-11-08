"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A photograph from the register's own store (/api/img/<id>), not from the
 * broker's server. The bytes are only asked for once the plate comes near the
 * viewport, so a page with 332 entries still opens quickly. If a building has
 * no photograph the plate stays blank, as a printed catalogue leaves a space
 * rather than inventing one.
 */
export default function ListingPhoto({
  id,
  alt,
  size = "card",
  className = "",
  credit,
}: {
  id: string;
  alt: string;
  size?: "card" | "hero";
  className?: string;
  credit?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  // The browser is asked to defer offscreen photographs, but a deferred image
  // that never arrives is worse than an eager one: once the plate is in the
  // viewport, make sure the request has actually been made.
  useEffect(() => {
    const img = ref.current?.querySelector("img");
    if (!img) return;
    const nudge = () => {
      const box = img.getBoundingClientRect();
      const visible = box.bottom > 0 && box.top < window.innerHeight && box.width > 0;
      if (!visible || img.naturalWidth > 0) return;
      if (img.loading !== "eager") img.loading = "eager";
      if (!img.complete) return;
      if (img.naturalWidth === 0) img.src = img.src;
    };
    nudge();
    window.addEventListener("scroll", nudge, { passive: true });
    return () => window.removeEventListener("scroll", nudge);
  }, []);

  return (
    <span ref={ref} className={`photo photo-${size}${failed ? " photo-blank" : ""} ${className}`.trim()}>
      {failed ? (
        <span className="photo-blank-mark" aria-hidden="true">
          ✠
        </span>
      ) : (
        <img
          src={`/api/img/${id}?s=${size}`}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      {size === "hero" && credit ? <span className="photo-credit">Photograph: {credit}</span> : null}
    </span>
  );
}
