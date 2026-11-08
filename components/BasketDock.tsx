"use client";

// The basket: a brass plate at the foot of the page, and a paper drawer
// with a stitched edge. Nothing here touches a server.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { displayName, fmt, getListing, priceLabel, whereLabel } from "@/lib/data";
import { emptyBasket, removeFromBasket, useBasket } from "@/lib/store";

export default function BasketDock() {
  const basket = useBasket();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    // close the drawer when the route changes
    setOpen(false);
  }, [pathname]);

  if (pathname?.startsWith("/checkout")) return null;

  const lines = basket
    .map((b) => getListing(b.id))
    .filter((l): l is NonNullable<typeof l> => l != null);
  const total = lines.reduce((s, l) => s + (l.price_usd ?? 0), 0);
  const unpriced = lines.filter((l) => l.price_usd == null).length;

  return (
    <>
      <button
        type="button"
        className="basket-plate"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="basket-drawer"
        aria-label={`Open the basket. ${basket.length} ${basket.length === 1 ? "building" : "buildings"}.`}
      >
        <span className="basket-roundel" aria-hidden="true">
          <span data-basket-count>{basket.length}</span>
        </span>
        <span className="basket-plate-text">
          Basket · <span>{basket.length}</span>
          {total > 0 && <em>{fmt(total)}</em>}
        </span>
      </button>

      <div
        id="basket-drawer"
        className="drawer"
        data-open={open}
        ref={drawerRef}
        role="dialog"
        aria-label="The basket"
        aria-hidden={!open}
      >
        <div className="drawer-head">
          <h3>The basket</h3>
          <button type="button" className="drawer-close" onClick={() => setOpen(false)} aria-label="Close the basket">
            Close
          </button>
        </div>
        <hr className="panel-rule" />
        {lines.length === 0 ? (
          <p className="drawer-empty">
            The basket is empty. Mark a building &ldquo;add to basket&rdquo; in the register and it
            will appear here.
          </p>
        ) : (
          <>
            <ul className="drawer-lines">
              {lines.map((l) => (
                <li key={l.id}>
                  <div className="drawer-line-main">
                    <Link href={`/church/${l.id}`} className="drawer-line-name">
                      {displayName(l)}
                    </Link>
                    <span className="drawer-line-where">{whereLabel(l)}</span>
                    <button
                      type="button"
                      className="footnote-link"
                      onClick={() => removeFromBasket(l.id)}
                      aria-label={`Remove ${displayName(l)} from the basket`}
                    >
                      remove
                    </button>
                  </div>
                  <div className="drawer-line-price">{priceLabel(l)}</div>
                </li>
              ))}
            </ul>
            <div className="drawer-total">
              <span>Asking, together</span>
              <strong>
                {fmt(total)}
                {unpriced > 0 ? ` + ${unpriced} by offer` : ""}
              </strong>
            </div>
            <div className="drawer-actions">
              <button type="button" className="btn brass" onClick={() => router.push("/checkout")}>
                Proceed to adoption
              </button>
              <button type="button" className="btn ghost" onClick={() => emptyBasket()}>
                Empty the basket
              </button>
            </div>
            <p className="drawer-fine">
              Adoption here is a demonstration. No payment is taken and no building changes hands.
            </p>
          </>
        )}
      </div>
    </>
  );
}
