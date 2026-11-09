"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A photograph from the register's own store (/api/img/<id>), not from the
 * broker's server. Bytes are asked for only when the plate is near the
 * viewport, or when the strip that owns it says this one is close to its
 * visible window. If a building has no photograph the plate stays blank, as a
 * printed catalogue leaves a space rather than inventing one.
 */
export default function ListingPhoto({
  id,
  alt,
  size = "card",
  className = "",
  credit,
  near = false,
}: {
  id: string;
  alt: string;
  size?: "card" | "hero";
  className?: string;
  credit?: string;
  near?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  // A deferred image that never arrives is worse than an eager one: once the
  // plate is on screen, make sure the request has actually been made.
  useEffect(() => {
    if (!near) return;
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
    document.addEventListener("scroll", nudge, { passive: true, capture: true });
    window.addEventListener("resize", nudge);
    return () => {
      document.removeEventListener("scroll", nudge, { capture: true });
      window.removeEventListener("resize", nudge);
    };
  }, [near]);

  const plate = (
    <span
      ref={ref}
      className={`photo photo-${size}${failed ? " photo-blank" : ""} ${className}`.trim()}
    >
      {failed ? (
        <span className="photo-blank-mark" aria-hidden="true">
          ✠
        </span>
      ) : near ? (
        <img
          src={`/api/img/${id}?s=${size}`}
          alt={alt}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );

  // the credit belongs under the plate, not inside its frame
  if (size !== "hero" || !credit || failed) return plate;

  return (
    <>
      {plate}
      <span className="photo-credit">Photograph: {credit}</span>
    </>
  );
}
