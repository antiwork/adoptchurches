const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const FROM = process.env.RESEND_FROM ?? "adoptchurches <register@adoptchurches.com>";
export const NOTIFY_TO = process.env.ADOPTCHURCHES_NOTIFY ?? "gumclaw@gumroad.com";

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(mail: Mail): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      return { ok: false, error: payload.message ?? `Resend returned ${response.status}.` };
    }
    return { ok: true, id: payload.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Send failed." };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- templates */

const PAPER = "#f3efe6";
const INK = "#191713";
const GOLD = "#8e7238";

function shell(body: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:${PAPER}">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:${PAPER};border:1px solid rgba(25,23,19,.28)">
    <tr><td style="padding:28px 30px 8px;font-family:'Cormorant Garamond',Garamond,Georgia,serif,serif">
      <div style="font-size:22px;color:${INK};letter-spacing:.01em">adopt<span style="color:${GOLD};font-style:italic">churches</span></div>
      <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#4a453c;padding-top:6px;border-bottom:1px solid rgba(25,23,19,.22);padding-bottom:10px">A register of buildings offered for disposal</div>
    </td></tr>
    <tr><td style="padding:18px 30px 28px;font-family:'EB Garamond',Garamond,Georgia,serif;font-size:15px;line-height:1.65;color:${INK}">
${body}
    </td></tr>
    <tr><td style="padding:0 30px 26px;font-family:'EB Garamond',Garamond,Georgia,serif;font-size:11px;line-height:1.6;color:#4a453c">
      adoptchurches · a demonstration register · no payment is taken, no building changes hands,
      and nothing here is an offer of securities.
    </td></tr>
  </table>
</body></html>`;
}

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  );

export function pledgeMail(pledge: {
  name: string;
  building: string;
  amountCents: number;
  note: string | null;
}) {
  const html = shell(`
      <p style="margin:0 0 14px">Your pledge has been entered against <strong>${esc(pledge.building)}</strong>.</p>
      <p style="margin:0 0 14px;font-size:26px;font-variant-numeric:oldstyle-nums">${money(
        pledge.amountCents,
      )}</p>
      ${
        pledge.note
          ? `<p style="margin:0 0 14px;font-style:italic;color:#4a453c">&ldquo;${esc(pledge.note)}&rdquo;</p>`
          : ""
      }
      <p style="margin:0;font-size:13px;color:#4a453c">A pledge records a name and an amount. It is not a
      donation, not an investment, and no money is taken. If enough is pledged for a building we write to
      everyone who pledged against it, and only then does anything happen.</p>`);

  const text = [
    `Your pledge of ${money(pledge.amountCents)} has been entered against ${pledge.building}.`,
    pledge.note ? `"${pledge.note}"` : "",
    "",
    "A pledge records a name and an amount. It is not a donation, not an investment, and no money is taken.",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: `Pledge entered — ${pledge.building}`, html, text };
}

export function notifyMail(subject: string, lines: string[]) {
  const html = shell(
    `<p style="margin:0 0 12px">${esc(subject)}</p>` +
      lines
        .map((line) => `<p style="margin:0 0 6px;font-size:14px">${esc(line)}</p>`)
        .join(""),
  );
  return { subject: `[adoptchurches] ${subject}`, html, text: [subject, "", ...lines].join("\n") };
}
