/**
 * Run once to get a Gmail OAuth2 refresh token.
 * Usage: node scripts/get-gmail-token.mjs
 *
 * Requires in .env.local:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GMAIL_USER_EMAIL
 */

import http from "http";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
let envContent = "";
try { envContent = readFileSync(envPath, "utf8"); } catch { /* ignore */ }

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  return process.env[key] ?? "";
}

const CLIENT_ID     = getEnv("GOOGLE_OAUTH_CLIENT_ID");
const CLIENT_SECRET = getEnv("GOOGLE_OAUTH_CLIENT_SECRET");
const REDIRECT_URI  = "http://localhost:3333/oauth/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\nשגיאה: חסרים GOOGLE_OAUTH_CLIENT_ID או GOOGLE_OAUTH_CLIENT_SECRET ב-.env.local\n");
  process.exit(1);
}

// ── Build auth URL ───────────────────────────────────────────────────────────
const params = new URLSearchParams({
  client_id:     CLIENT_ID,
  redirect_uri:  REDIRECT_URI,
  response_type: "code",
  scope:         "https://www.googleapis.com/auth/gmail.send",
  access_type:   "offline",
  prompt:        "consent",   // force consent to always get refresh_token
});

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

console.log("\n=== Gmail OAuth2 — קבלת Refresh Token ===\n");
console.log("1. פתח את הקישור הבא בדפדפן:\n");
console.log("   " + authUrl);
console.log("\n2. התחבר עם guydinay@gmail.com ואשר הרשאות");
console.log("3. המתן — הסקריפט יסיים אוטומטית\n");

// ── Start local server to catch the redirect ─────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3333");
  if (!url.pathname.startsWith("/oauth/callback")) {
    res.end("not found"); return;
  }

  const code = url.searchParams.get("code");
  const err  = url.searchParams.get("error");

  if (err) {
    res.end(`<h2>שגיאה: ${err}</h2>`);
    console.error("\nשגיאה:", err);
    server.close();
    return;
  }

  if (!code) { res.end("no code"); return; }

  // Exchange code for tokens
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      res.end(`<h2>שגיאה: ${tokens.error_description}</h2>`);
      console.error("\nשגיאה בהחלפת קוד לטוקן:", tokens.error_description);
      server.close();
      return;
    }

    res.end(`
      <html dir="rtl" style="font-family:sans-serif;padding:40px;background:#0d0d18;color:white">
        <h2 style="color:#86efac">✓ הצלחה! הטוקן הועתק לקונסול</h2>
        <p>ניתן לסגור את הדפדפן ולחזור לטרמינל</p>
      </html>
    `);

    console.log("\n✓ הצלחה!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("GMAIL REFRESH TOKEN:");
    console.log(tokens.refresh_token);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nהוראות:");
    console.log("1. העתק את הטוקן למעלה");
    console.log("2. כנס ל- https://invoice.nadlanisti.co.il/dashboard/settings");
    console.log("3. הדבק בשדה 'Gmail Refresh Token' ושמור\n");

    if (!tokens.refresh_token) {
      console.warn("⚠️  לא התקבל refresh_token — ייתכן שהאפליקציה כבר אושרה בעבר.");
      console.warn("   כנס ל-https://myaccount.google.com/permissions ובטל גישה לאפליקציה, ואז הרץ שוב.\n");
    }

  } catch (e) {
    res.end(`<h2>שגיאה: ${e.message}</h2>`);
    console.error("\nשגיאה:", e.message);
  }

  server.close();
});

server.listen(3333, () => {
  console.log("(ממתין לאישור בדפדפן — שרת פועל על פורט 3333)\n");
});
