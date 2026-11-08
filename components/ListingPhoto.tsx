"use client";

import { useState } from "react";

/**
 * A photograph from the register's own store (/api/img/<id>), not from the
 * broker's server. If a building has no photograph the plate stays blank, as a
 * printed catalogue leaves a space rather than inventing one.
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

  return (
    <span className={`photo photo-${size}${failed ? " photo-blank" : ""} ${className}`.trim()}>
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
