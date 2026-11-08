import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { demandSummary, topDemand } from "@/lib/demand";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDb()) return NextResponse.json({ error: "no database" }, { status: 503 });
  const [summary, top] = await Promise.all([demandSummary(), topDemand(25)]);
  return NextResponse.json({ summary, top });
}
