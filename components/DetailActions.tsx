"use client";

// Collect and support controls on the particulars sheet.

import { CollectSeal, SupportLink } from "@/components/Controls";
import { useCollected } from "@/lib/store";

export default function DetailActions({ id, name }: { id: string; name: string }) {
  const collected = useCollected();
  const isCollected = collected.includes(id);
  return (
    <div className="detail-actions">
      <CollectSeal id={id} name={name} large />
      <span className="detail-actions-note">
        {isCollected ? "Kept on your list." : "Keep this building."}
      </span>
      <SupportLink id={id} name={name} wide />
    </div>
  );
}
