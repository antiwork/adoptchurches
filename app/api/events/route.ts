import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { recordEvent, type EventKind } from "@/lib/demand";
import { getListing } from "@/lib/data";

export const dynamic = "force-dynamic";

const KINDS: EventKind[] = ["collect", "uncollect", "basket", "remove", "view"];

export async function POST(request: Request) {
  if (!hasDb()) return NextResponse.json({ ok: false, reason: "no database" }, { status: 503 });

  let body: { kind?: string; listingId?: string; sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const kind = body.kind as EventKind;
  const listingId = body.listingId ?? "";
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown event." }, { status: 422 });
  if (!getListing(listingId)) return NextResponse.json({ error: "Not in the atlas." }, { status: 404 });

  try {
    await recordEvent(kind, listingId, (body.sessionId ?? "").slice(0, 64) || null);
  } catch (error) {
    // demand counts are a nice-to-have; never break the page over them
    return NextResponse.json({ ok: false, reason: (error as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
