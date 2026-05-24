# Nadlanisti CRM — Claude Context

## מה המערכת עושה
מערכת CRM פנימית לגיא (guydinay@gmail.com) — נדלניסטי 360. מנהלת ~30 לקוחות, יוצרת חשבוניות ב-EZCount, ושולחת דוחות חודשיים במייל מ-Gmail של גיא.

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
- Gmail API OAuth2 — שליחת מיילים טקסט פשוט
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
    /settings                 — הגדרות (עתידי)
  /api
    /cron
      /generate-drafts        — 1 לחודש 09:00 (עתידי)
      /process-auto-cc        — 1 לחודש 10:00 (עתידי)
      /monthly-reports        — 1 לחודש 11:00 (עתידי)

/lib
  /supabase
    client.ts                 — createBrowserClient (ללא <Database> generic)
    server.ts                 — createServerClient (ללא <Database> generic)
    middleware.ts             — Supabase middleware
  types.ts                    — טיפוסי אפליקציה (BillingType, DraftStatus, LineItem, labels...)
  ezcount.ts                  — EZCount API wrapper (עתידי)
  gmail.ts                    — Gmail API wrapper (עתידי)
  calc.ts                     — חישוב סכומים + מע"מ (עתידי)
  email-templates.ts          — תבניות מיילים בעברית (עתידי)

/types
  db.ts                       — TypeScript types ידניים (ClientRow, DraftRow, etc.)

/components
  /ui                         — shadcn/ui components
  dashboard-sidebar.tsx       — Sidebar RTL עם ניווט

/supabase
  /migrations
    001_initial_schema.sql    — כל הטבלאות + RLS + triggers

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
