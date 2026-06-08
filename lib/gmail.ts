interface SendEmailParams {
  refreshToken: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
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

function buildRawMessage(to: string, cc: string | undefined, subject: string, body: string): string {
  const from = process.env.GMAIL_USER_EMAIL!;
  const headers: string[] = [
    `From: ${from}`,
    `To: ${to}`,
  ];
  if (cc?.trim()) headers.push(`Cc: ${cc.trim()}`);
  headers.push(
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body).toString("base64"),
  );
  return Buffer.from(headers.join("\r\n")).toString("base64url");
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const accessToken = await getAccessToken(params.refreshToken);
  const raw = buildRawMessage(params.to, params.cc, params.subject, params.body);

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
