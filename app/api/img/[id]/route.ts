import { NextResponse } from "next/server";
import { hasDb, query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Photographs are kept in the database, not hotlinked, and served from here
 * with a year-long immutable cache so the CDN holds them and the database is
 * asked once per size.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const size = new URL(request.url).searchParams.get("s") ?? "card";
  const column = size === "hero" ? "hero" : size === "blur" ? null : "card";

  if (!hasDb()) return new NextResponse(null, { status: 404 });

  if (size === "blur") {
    const [row] = await query<{ blur: string | null }>(
      `select blur from listing_images where listing_id = $1`,
      [id],
    );
    if (!row?.blur) return new NextResponse(null, { status: 404 });
    const base64 = row.blur.split(",")[1] ?? "";
    const bytes = Buffer.from(base64, "base64");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  }

  const [row] = await query<{ bytes: Buffer | null; sha: string | null }>(
    `select ${column} as bytes, sha256 as sha from listing_images where listing_id = $1`,
    [id],
  );
  if (!row?.bytes) return new NextResponse(null, { status: 404 });

  const etag = `"${row.sha ?? id}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(row.bytes.length),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable, stale-while-revalidate=604800",
      ETag: etag,
    },
  });
}
