"use client";

// Collect and basket controls on the particulars sheet.

import { BasketToggle, CollectSeal } from "@/components/Controls";
import { useCollected } from "@/lib/store";

export default function DetailActions({ id, name }: { id: string; name: string }) {
  const collected = useCollected();
  const isCollected = collected.includes(id);
  return (
    <div className="detail-actions">
      <CollectSeal id={id} name={name} large />
      <span className="detail-actions-note">
        {isCollected ? "In your collection." : "Collect this building."}
      </span>
      <BasketToggle id={id} name={name} wide />
    </div>
  );
}
