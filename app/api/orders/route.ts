import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { createOrder, markOrderEmailed } from "@/lib/orders";
import { mailConfigured, notifyMail, receiptMail, sendMail, NOTIFY_TO } from "@/lib/mail";

export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  email?: string;
  town?: string;
  note?: string;
  items?: { listingId?: string; qty?: number }[];
};

export async function POST(request: Request) {
  if (!hasDb()) {
    return NextResponse.json({ error: "The register has no database yet." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const town = (body.town ?? "").trim() || null;
  const note = (body.note ?? "").trim() || null;

  if (name.length < 2) return NextResponse.json({ error: "A name, for the register." }, { status: 422 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 422 });
  }

  const items = (body.items ?? [])
    .filter((item) => typeof item?.listingId === "string")
    .map((item) => ({ listingId: item.listingId as string, qty: item.qty }));
  if (!items.length) return NextResponse.json({ error: "The basket is empty." }, { status: 422 });

  const order = await createOrder({ name, email, town, note, items });
  if ("error" in order) return NextResponse.json({ error: order.error }, { status: 422 });

  // Email is best-effort: an order that is written down is still an order.
  let emailError: string | null = null;
  if (mailConfigured()) {
    const receipt = receiptMail(order);
    const buyer = await sendMail({
      to: order.email,
      subject: receipt.subject,
      html: receipt.html,
      text: receipt.text,
      replyTo: NOTIFY_TO,
    });
    const internal = notifyMail("New adoption order", [
      `No. ${order.reference}`,
      `${order.name}${order.town ? ` of ${order.town}` : ""} — ${order.email}`,
      ...order.items.map((item) => `${item.name} — ${item.priceLabel}`),
      `Total $${(order.totalCents / 100).toLocaleString("en-US")}`,
      ...(order.note ? [`Note: ${order.note}`] : []),
    ]);
    const alert = await sendMail({
      to: NOTIFY_TO,
      subject: internal.subject,
      html: internal.html,
      text: internal.text,
      replyTo: order.email,
    });
    emailError = [buyer.error, alert.error].filter(Boolean).join(" · ") || null;
  } else {
    emailError = "RESEND_API_KEY is not set; no mail sent.";
  }
  await markOrderEmailed(order.id, emailError);

  return NextResponse.json({ ok: true, order, emailed: !emailError, emailError }, { status: 201 });
}

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("reference");
  if (!reference) return NextResponse.json({ error: "Which order?" }, { status: 400 });
  const { query } = await import("@/lib/db");
  const [order] = await query<{ reference: string; name: string; created_at: string; total_cents: string }>(
    `select reference, name, created_at::text, total_cents::text from orders where reference = $1`,
    [reference],
  );
  if (!order) return NextResponse.json({ error: "Not in the register." }, { status: 404 });
  const items = await query<{ name: string; price_label: string }>(
    `select oi.name, oi.price_label from order_items oi
       join orders o on o.id = oi.order_id where o.reference = $1 order by oi.id`,
    [reference],
  );
  return NextResponse.json({
    order: {
      reference: order.reference,
      name: order.name,
      createdAt: order.created_at,
      totalCents: Number(order.total_cents),
      items,
    },
  });
}
