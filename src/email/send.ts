import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type Outgoing = {
  to: string;
  subject: string;
  react: ReactElement;
  /** One-click unsubscribe URL (RFC 8058). Required for digests. */
  unsubscribeUrl?: string;
};

let resend: Resend | undefined;

/** RFC 2606 reserved domains used by tests. Never sent for real, even with a Resend key. */
const RESERVED_RECIPIENT = /@([a-z0-9-]+\.)*(example\.(com|net|org|edu)|[a-z0-9-]+\.(test|invalid|localhost))$/i;

/** Sends through Resend when configured. In dev without a key, writes HTML to ./.outbox. */
export async function sendEmail(msg: Outgoing): Promise<{ id: string | null }> {
  const [html, text] = await Promise.all([render(msg.react), render(msg.react, { plainText: true })]);
  const headers: Record<string, string> = {};
  if (msg.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${msg.unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const reserved = RESERVED_RECIPIENT.test(msg.to);
  if (!env.resendApiKey || reserved) {
    if (env.isProd && !reserved) throw new Error("RESEND_API_KEY is required in production");
    const dir = path.join(process.cwd(), ".outbox");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${msg.to.replace(/[^a-z0-9]/gi, "_")}.html`);
    await writeFile(file, `<!-- To: ${msg.to}\nSubject: ${msg.subject} -->\n${html}`);
    console.log(`[email] dev outbox: ${file}`);
    return { id: null };
  }

  resend ??= new Resend(env.resendApiKey);
  const { data, error } = await resend.emails.send({
    from: env.emailFrom,
    to: msg.to,
    subject: msg.subject,
    html,
    text,
    headers,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { id: data?.id ?? null };
}
