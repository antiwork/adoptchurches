import { NextResponse } from "next/server";
import { getListing } from "@/lib/data";
import { addPledge, aggregateAll, aggregateFor, validatePledge } from "@/lib/pledges";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const listingId = new URL(request.url).searchParams.get("listing");
  if (listingId) return NextResponse.json(await aggregateFor(listingId));
  return NextResponse.json(await aggregateAll());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const parsed = validatePledge(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });
  if (!getListing(parsed.value.listingId)) {
    return NextResponse.json({ error: "That building isn't in the atlas." }, { status: 404 });
  }

  await addPledge(parsed.value);
  const aggregate = await aggregateFor(parsed.value.listingId);
  return NextResponse.json({ ok: true, ...aggregate }, { status: 201 });
}
