import { randomUUID } from "crypto";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  mimeType?: string; // defaults to application/pdf
}

interface SendEmailParams {
  refreshToken: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

interface TokenResponse {
  access_token: string;
}

const FETCH_TIMEOUT_MS = 10_000;

async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`OAuth token refresh failed: ${res.status}`);
  const json = (await res.json()) as TokenResponse;
  if (!json.access_token) throw new Error("OAuth: no access_token in response");
  return json.access_token;
}

/** Chunk base64 into 76-char lines per RFC 2045 (required for attachments). */
function base64Lines(buf: Buffer): string {
  return buf.toString("base64").replace(/(.{76})/g, "$1\r\n");
}

function buildHeaders(to: string, cc: string | undefined, subject: string): string[] {
  const from = process.env.GMAIL_USER_EMAIL!;
  const headers = [`From: ${from}`, `To: ${to}`];
  if (cc?.trim()) headers.push(`Cc: ${cc.trim()}`);
  headers.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`);
  return headers;
}

function buildSimpleMessage(to: string, cc: string | undefined, subject: string, body: string): string {
  const lines = [
    ...buildHeaders(to, cc, subject),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body).toString("base64"),
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

function buildMultipartMessage(
  to: string,
  cc: string | undefined,
  subject: string,
  body: string,
  attachments: EmailAttachment[],
): string {
  const boundary = `=_nadlanisti_${randomUUID()}`;
  const parts: string[] = [
    ...buildHeaders(to, cc, subject),
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body).toString("base64"),
  ];

  for (const att of attachments) {
    const mime = att.mimeType ?? "application/pdf";
    // Keep filename ASCII-safe for the header.
    const safeName = att.filename.replace(/["\\\r\n]/g, "_");
    parts.push(
      `--${boundary}`,
      `Content-Type: ${mime}; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(att.content),
    );
  }

  parts.push(`--${boundary}--`, "");
  return Buffer.from(parts.join("\r\n")).toString("base64url");
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const accessToken = await getAccessToken(params.refreshToken);
  const raw = params.attachments?.length
    ? buildMultipartMessage(params.to, params.cc, params.subject, params.body, params.attachments)
    : buildSimpleMessage(params.to, params.cc, params.subject, params.body);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${res.status} — ${err}`);
  }
}
