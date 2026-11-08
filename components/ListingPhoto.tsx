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
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={ref} className={`photo photo-${size}${failed ? " photo-blank" : ""} ${className}`.trim()}>
      {failed ? (
        <span className="photo-blank-mark" aria-hidden="true">
          ✠
        </span>
      ) : shown ? (
        <img
          src={`/api/img/${id}?s=${size}`}
          alt={alt}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : null}
      {size === "hero" && credit ? <span className="photo-credit">Photograph: {credit}</span> : null}
    </span>
  );
}
