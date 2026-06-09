# Nadlanisti CRM — Claude Context

## מה המערכת עושה
מערכת CRM פנימית לגיא (guydinay@gmail.com) — נדלניסטי 360. מנהלת ~30 לקוחות, יוצרת חשבוניות ב-EZCount, ושולחת דוחות חודשיים במייל מ-Gmail של גיא.

בנוסף, **אזור נפרד** לאוטומציית חשבוניות מדיה: משיכת חשבוניות מפייסבוק/גוגל דרך BrowserAct ושליחתן ללקוח. מוצר נפרד — לשונית והגדרות משלו, **לא מעורבב** עם זרימת החשבוניות/דוחות.

## פורט הפיתוח
`npm run dev` מריץ על **פורט 2000** (`http://localhost:2000`)

## Supabase
- **Project URL:** `https://yovearxujbipkkizxcgx.supabase.co`
- **Project ID:** `yovearxujbipkkizxcgx`
- מפתחות ב-`.env.local` (לא ב-code)
- ה-Supabase clients ב-`lib/supabase/` **לא** משתמשים ב-`<Database>` generic בגלל תאימות עם Supabase JS v2.105 — טיפוסים מנוהלים ידנית ב-`types/db.ts`

## Stack
- Next.js 14 (App Router) + TypeScript strict
- Tailwind CSS + shadcn/ui (neutral theme, Minimal Brutalism)
- Supabase (auth + database) — JS v2.105
- RTL עברית עם פונט Heebo
- EZCount API — יצירת חשבוניות ישראליות
- Gmail API OAuth2 — שליחת מיילים, כולל **צירוף PDF** (multipart/mixed)
- BrowserAct REST API — דפדפן ענן למשיכת חשבוניות מפלטפורמות פרסום
- react-hook-form + zod v4 לפורמים

## עיצוב — Minimal Brutalism
- `--radius: 0` — אין עיגול פינות
- גבולות 2px כהים (`border-2 border-foreground`)
- צבע accent צהוב (`hsl(47 100% 50%)`)
- רקע off-white חמים (`hsl(50 20% 97%)`)
- Shadows: `shadow-[2px_2px_0px_0px_...]` / `shadow-[4px_4px_0px_0px_...]`
- Dialogs: `rounded-none shadow-[4px_4px_0px_0px_hsl(var(--foreground))]`
- כל טקסט UI בעברית — אין אנגלית למשתמש

## כללים חשובים
- **RTL בכל מקום** — `lang="he" dir="rtl"` ב-html
- **Sidebar מימין** (בגלל RTL)
- **אין `any` ב-TypeScript** — אלא אם הכרחי ומוסבר
- **אין comments מיותרים** — רק כשה-WHY לא ברור
- **Server Components בברירת מחדל** — `"use client"` רק לאינטראקציה
- **Server Actions** לכל מוטציות DB — עם `'use server'` ב-`actions.ts` ליד הדף
- **Zod** לכל ולידציה של input

## סוגי לקוחות
| Type | billing_type | תיאור |
|------|-------------|--------|
| A | `fixed` | ריטיינר קבוע — גיא מאשר draft ידנית |
| B | `media_commission` | 9% עמלה על Google/Facebook spend |
| C | `auto_cc` | אוטומטי — חשבונית עסקה + קבלה ב-1 לחודש |

## מצבי draft (status)
- `pending_review` — ממתין לאישור גיא
- `approved` — אושר, עומד להיות מעובד
- `sent` — הכל הצליח
- `failed` — EZCount נכשל
- `skipped` — גיא דילג
- `invoiced_pending_combined` — חשבונית נוצרה, ממתין לדוח חודשי משולב
- `invoiced_email_failed` — חשבונית נוצרה, מייל נכשל — יש כפתור "שלח שוב"

## סוגי מסמכים EZCount
- `300` = חשבונית עסקה (Proforma)
- `305` = חשבונית מס
- `320` = חשבונית מס קבלה (Tax Receipt) — ברירת מחדל
- `400` = קבלה

## Email delivery modes
- `combined` — דוח + חשבונית במייל אחד (1 לחודש)
- `separate` — חשבונית מיד עם אישור, דוח נפרד (1 לחודש)

## מבנה תיקיות
```
/app
  /login                      — עמוד כניסה
  /dashboard
    layout.tsx                — מגן auth + sidebar
    page.tsx                  — עמוד ראשי (redirect)
    /clients
      page.tsx                — Server Component — שולף לקוחות
      actions.ts              — Server Actions: create/update/toggle/delete
      client-list.tsx         — Client Component — טבלה + dialogs
      client-form.tsx         — Dialog: צור/ערוך לקוח + שורות חיוב
    /queue
      page.tsx                — Server Component — שולף pending_review
      actions.ts              — Server Actions: approve/skip/updateLines
      queue-list.tsx          — Client Component — רשימת טיוטות + אישור
    /invoices                 — ארכיון חשבוניות (עתידי)
    /reports                  — דוחות חודשיים (עתידי)
    /settings                 — הגדרות (קיים — EZCount/Gmail/חיוב/תבנית)
    /ad-automation            — *** אזור נפרד: אוטומציית חשבוניות מדיה ***
      page.tsx                — תור ביקורת + "הרץ עכשיו"
      actions.ts              — Server Actions: settings/accounts/run/send/skip
      ad-automation-client.tsx— Client Component — תור + PDF preview + שליחה
      /settings               — הגדרות BrowserAct + חשבונות + תבנית מייל (נפרד)
  /api
    /cron
      /generate-drafts        — 1 לחודש (POST + Bearer)
      /scrape-ad-invoices     — יומי, מסונן לפי scrape_day (GET native / POST חיצוני)

/lib
  /supabase
    client.ts                 — createBrowserClient (ללא <Database> generic)
    server.ts                 — createServerClient (ללא <Database> generic)
    middleware.ts             — Supabase middleware
  types.ts                    — טיפוסי אפליקציה (BillingType, DraftStatus, LineItem, labels...)
  ezcount.ts                  — EZCount API wrapper (קיים)
  gmail.ts                    — Gmail API wrapper (קיים — תומך צירוף PDF)
  calc.ts                     — חישוב סכומים + מע"מ (קיים)
  email-templates.ts          — תבניות מיילים בעברית (קיים)
  browseract.ts               — BrowserAct REST client (run-task → poll → fetch PDF)
  ad-invoice-scraper.ts       — תזמור משיכה: account → PDF → storage → draft
  ad-email.ts                 — תבנית מייל ייעודית לחשבוניות מדיה

/types
  db.ts                       — TypeScript types ידניים (ClientRow, DraftRow, AdAccountRow, etc.)

/components
  /ui                         — shadcn/ui components
  dashboard-sidebar.tsx       — Sidebar RTL עם ניווט (כולל "אוטומציית מדיה")

/supabase
  /migrations
    001_initial_schema.sql    — כל הטבלאות + RLS + triggers
    005_ad_invoice_automation.sql — טבלאות מדיה + bucket ad-invoices + RLS

vercel.json                   — הגדרת cron (Vercel native) ל-scrape-ad-invoices

/scripts
  generate-refresh-token.ts   — OAuth token helper (עתידי)
```

## סכמת DB — טבלאות קיימות
| טבלה | תיאור |
|------|--------|
| `clients` | לקוחות — billing_type, doc_type, line templates |
| `invoice_line_templates` | שורות חיוב חוזרות per client |
| `invoice_drafts` | טיוטות חשבוניות — status, line_items (jsonb), totals |
| `invoices_sent` | ארכיון חשבוניות שנשלחו |
| `email_log` | לוג כל המיילים |
| `ads_invoices` | חשבוניות פרסום (Module 3 — עתידי) |
| `app_settings` | הגדרות גלובליות — שורה אחת, id=1 |
| `ad_automation_settings` | הגדרות BrowserAct — שורה אחת, id=1 (נפרד מ-app_settings) |
| `ad_accounts` | מיפוי לקוח → חשבון פרסום (facebook/google) |
| `ad_invoice_drafts` | טיוטות חשבוניות מדיה שנמשכו — status, pdf_path, billing_month |

bucket אחסון פרטי **`ad-invoices`** ל-PDFים שנמשכו (Supabase Storage).
RLS פעיל על כולן — `authenticated` יכול הכל.
Trigger `set_updated_at()` על clients, invoice_drafts, ads_invoices, app_settings.

## EZCount API
```
POST https://www.ezcount.co.il/api/createDoc
Auth: api_key + api_email בגוף הבקשה
send_email_original: false (תמיד — אנחנו שולחים דרך Gmail)
lang: "he"
```

## Cron Auth
כל endpoint של cron מוגן עם:
`Authorization: Bearer ${CRON_SECRET}`

`scrape-ad-invoices` תומך גם ב-**GET** (Vercel native cron — שולח את ה-Bearer אוטומטית) וגם ב-**POST** (מתזמן חיצוני, עם `billing_month`/`force` אופציונליים). רץ יומית ב-`vercel.json` אבל פועל רק ביום שמוגדר ב-`scrape_day` (ברירת מחדל 6).

## אוטומציית חשבוניות מדיה (BrowserAct) — מוצר נפרד
**בידול מוחלט מזרימת החשבוניות/דוחות** — טבלאות, bucket, עמוד הגדרות ותבנית מייל נפרדים. אסור למזג.

**הזרימה (6 לחודש):**
1. cron → `scrapeAdInvoices` עם admin client
2. לכל `ad_accounts` פעיל → מריץ workflow ב-BrowserAct (`account_id` + `billing_month`)
3. `profile_id` = session קבוע שבו login הסוכנות נשמר (פייסבוק + גוגל) — מתחברים ידנית פעם אחת
4. ה-PDF חוזר ב-`output.files` → נשמר ב-bucket `ad-invoices` → נוצרת `ad_invoice_drafts` עם status `pending_review`
5. גיא נכנס ל-`/dashboard/ad-automation` → "אשר ושלח" → מייל ללקוח עם ה-PDF מצורף

כשל בחשבון אחד **לא** מפיל את השאר (נרשם כ-`failed` עם הודעת שגיאה). סטטוסים: `pending_review/sent/failed/skipped`.
Gmail token נלקח מ-`app_settings` (תשתית משותפת); כל שאר ההגדרות ב-`ad_automation_settings`.

## חישוב מע"מ
- מע"מ ברירת מחדל: **18%**
- `vat_rate` נשמר ב-`app_settings` (ניתן לשינוי)
- `subtotal` = סכום שורות לפני מע"מ
- `vat` = `round(subtotal * vat_rate, 2)`
- `total` = `subtotal + vat`

## סשנים שהושלמו
- [x] Session 1: Next.js + RTL + shadcn/ui + Supabase clients + Login + Dashboard layout
- [x] Session 2: DB Schema (SQL migration) + TypeScript types (`types/db.ts`)
- [x] Session 3: עמוד ניהול לקוחות — CRUD מלא + שורות חיוב + עיצוב Minimal Brutalism
- [x] Session 4 (חלקי): תור אישור — עמוד queue עם approve/skip על drafts קיימים
- [x] Session 5: עיצוב AI Digital Dark — sidebar, login, dashboard, clients, queue
- [x] Session 6: חיבור מלא — lib/calc.ts, lib/ezcount.ts, lib/gmail.ts, עמוד הגדרות, approve flow אמיתי
- [x] Session 7: מיילים נוספים per-לקוח (invoices/reports/both) + **אזור אוטומציית מדיה** מקצה לקצה (BrowserAct, cron, צירוף PDF, migration 005)

## Flow אישור חשבונית (מלא)

1. גיא לוחץ "אשר" בתור → `approveDraftAction`
2. קריאה ל-EZCount API → מקבל `doc_number` + `doc_url`
3. אם `email_delivery_mode = "separate"` → שולח מייל דרך Gmail OAuth2
4. אם `email_delivery_mode = "combined"` → status = `invoiced_pending_combined` (ימתין לדוח חודשי)
5. מעדכן `invoice_drafts.status` + `ezcount_doc_number/url`
6. מוסיף שורה ל-`invoices_sent` + ל-`email_log`

## הבא לפיתוח

- `/api/cron/generate-drafts` — יצירת טיוטות אוטומטית ב-1 לחודש
- עמוד `/dashboard/invoices` — ארכיון חשבוניות שנשלחו
- Gmail OAuth2 setup — `scripts/generate-refresh-token.ts`
- לוגיקת "שלח שוב" עבור `invoiced_email_failed`

## env vars נדרשים
ראה `.env.local.example` בשורש הפרויקט
