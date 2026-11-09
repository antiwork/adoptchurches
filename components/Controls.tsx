"use client";

// The wax seal (collect) and the support link, shared by the register rows,
// the entry plate, and the particulars sheet. There is no basket: the only
// action is a pledge, and a pledge is not a purchase.

import Link from "next/link";
import { toggleCollected, useCollected } from "@/lib/store";

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
      aria-label={on ? `Remove ${name} from your list` : `Keep ${name} on your list`}
      title={on ? "Kept. Press to release." : "Keep this building."}
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

export function SupportLink({
  id,
  name,
  wide = false,
}: {
  id: string;
  name: string;
  wide?: boolean;
}) {
  return (
    <Link
      href={`/church/${id}#support`}
      className={`support-link${wide ? " wide" : ""}`}
      aria-label={`Put your support behind ${name}`}
      onClick={(e) => e.stopPropagation()}
    >
      {wide ? "Pledge your support" : "Support"}
    </Link>
  );
}
