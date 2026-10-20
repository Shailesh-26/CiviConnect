import nodemailer from "nodemailer";
import { env } from "../config/env";

export const mailConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transport = mailConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 465,
      secure: (env.SMTP_PORT ?? 465) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

type Mail = { to: string; subject: string; text: string; html: string };

/**
 * Sends an email when SMTP is set up in server/.env. Otherwise prints it in the server terminal,
 * so every email feature still works on a laptop during development and demos.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!transport) {
    console.log(`\n[email not configured] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return false;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM || `CiviConnect <${env.SMTP_USER}>`, ...mail });
    return true;
  } catch (err) {
    console.warn("Email failed:", (err as Error).message);
    console.log(`[email fallback] To: ${mail.to}\n${mail.text}\n`);
    return false;
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// A plain, branded email body. Inline styles only, because email apps ignore stylesheets.
// Every piece of text is escaped: a user's name like "<a href=...>" must arrive as plain text.
export function emailLayout(title: string, paragraphs: string[], button?: { text: string; url: string }) {
  title = escapeHtml(title);
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.55">${escapeHtml(p)}</p>`).join("");
  const cta = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="background:#1f4e79;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(button.text)}</a></p>`
    : "";
  return `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f5f1;padding:28px"><div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e5e7eb">
<p style="margin:0 0 18px;font-weight:700;font-size:18px;color:#1f4e79">Civi<span style="color:#e0a100">Connect</span></p>
<h1 style="margin:0 0 14px;font-size:22px;color:#17202b">${title}</h1>${body}${cta}
<p style="margin:24px 0 0;color:#94a3b8;font-size:12px">You received this because of an action on your CiviConnect account.</p></div></div>`;
}
