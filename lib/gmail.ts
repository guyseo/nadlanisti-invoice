interface SendEmailParams {
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
}

interface TokenResponse {
  access_token: string;
}

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
  });

  if (!res.ok) throw new Error(`OAuth token refresh failed: ${res.status}`);
  const json = (await res.json()) as TokenResponse;
  return json.access_token;
}

function buildRawMessage(to: string, subject: string, body: string): string {
  const from = process.env.GMAIL_USER_EMAIL!;
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(body).toString("base64"),
  ].join("\r\n");

  return Buffer.from(raw).toString("base64url");
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const accessToken = await getAccessToken(params.refreshToken);
  const raw = buildRawMessage(params.to, params.subject, params.body);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${res.status} — ${err}`);
  }
}
