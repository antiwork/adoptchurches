"use client";

// The wax seal (collect) and the basket control, shared by the register
// rows, the entry plate, and the particulars sheet.

import { toggleBasket, toggleCollected, useBasket, useCollected } from "@/lib/store";

export function CollectSeal({ id, name, large = false }: { id: string; name: string; large?: boolean }) {
  const collected = useCollected();
  const on = collected.includes(id);
  return (
    <button
      type="button"
      className={`seal${large ? " large" : ""}`}
      data-collect={id}
      data-on={on}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from your collection` : `Add ${name} to your collection`}
      title={on ? "Collected. Press to release." : "Collect this building."}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCollected(id);
      }}
    >
      <span aria-hidden="true">{on ? "✓" : ""}</span>
    </button>
  );
}

export function BasketToggle({
  id,
  name,
  wide = false,
}: {
  id: string;
  name: string;
  wide?: boolean;
}) {
  const basket = useBasket();
  const on = basket.some((l) => l.id === id);
  return (
    <button
      type="button"
      className={`basket-add${wide ? " wide" : ""}`}
      data-basket={id}
      data-on={on}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from the basket` : `Add ${name} to the basket`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBasket(id);
      }}
    >
      {on ? (wide ? "In the basket · remove" : "In basket") : wide ? "Add to basket" : "Basket"}
    </button>
  );
}
