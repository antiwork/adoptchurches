import { NextResponse } from "next/server";
import { getListing } from "@/lib/data";
import { hasDb } from "@/lib/db";
import { validatePledge } from "@/lib/pledges";
import { addPledge, aggregateAll, aggregateFor, recordPledgeMail } from "@/lib/pledges-db";
import { mailConfigured, notifyMail, pledgeMail, sendMail, NOTIFY_TO } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasDb()) return NextResponse.json({});
  const listingId = new URL(request.url).searchParams.get("listing");
  if (listingId) return NextResponse.json(await aggregateFor(listingId));
  return NextResponse.json(await aggregateAll());
}

export async function POST(request: Request) {
  if (!hasDb()) {
    return NextResponse.json({ error: "The register has no database yet." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const parsed = validatePledge(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 });

  const listing = getListing(parsed.value.listingId);
  if (!listing) {
    return NextResponse.json({ error: "That building isn't in the atlas." }, { status: 404 });
  }

  const saved = await addPledge(parsed.value);

  // Mail is best-effort: the pledge is recorded whether or not Resend answers.
  if (mailConfigured()) {
    const mail = pledgeMail({
      name: parsed.value.name,
      building: listing.name,
      amountCents: parsed.value.amountCents,
      note: parsed.value.note,
    });
    const letter = await sendMail({
      to: parsed.value.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: NOTIFY_TO,
    }).catch(() => undefined);

    const alert = notifyMail("New pledge", [
      `${parsed.value.name} pledged $${(parsed.value.amountCents / 100).toLocaleString("en-US")} against ${listing.name}.`,
      parsed.value.email,
      ...(parsed.value.note ? [`Note: ${parsed.value.note}`] : []),
    ]);
    const alertSent = await sendMail({
      to: NOTIFY_TO,
      subject: alert.subject,
      html: alert.html,
      text: alert.text,
    }).catch(() => undefined);

    await recordPledgeMail(saved.id, {
      pledgeEmailId: letter?.id,
      notifyEmailId: alertSent?.id,
    }).catch(() => undefined);
  }

  const aggregate = await aggregateFor(parsed.value.listingId);
  return NextResponse.json({ ok: true, ...aggregate }, { status: 201 });
}
