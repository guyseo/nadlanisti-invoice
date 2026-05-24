export const INVOICE_PLACEHOLDERS = [
  { key: "שם_לקוח",         desc: "שם הלקוח" },
  { key: "מספר_חשבונית",    desc: "מספר המסמך" },
  { key: "סה_כ",            desc: "סכום כולל מע״מ" },
  { key: "לפני_מעמ",        desc: "לפני מע״מ" },
  { key: "מעמ",             desc: "סכום המע״מ" },
  { key: "קישור",           desc: "קישור לחשבונית" },
  { key: "חודש_חיוב",       desc: "חודש החיוב" },
] as const;

export const DEFAULT_INVOICE_SUBJECT =
  "חשבונית {{מספר_חשבונית}} — {{שם_לקוח}}";

export const DEFAULT_INVOICE_BODY =
  'שלום {{שם_לקוח}},\n\nמצורפת חשבונית מספר {{מספר_חשבונית}} עבור השירותים שניתנו.\n\nסיכום:\nלפני מע"מ: ₪{{לפני_מעמ}}\nמע"מ: ₪{{מעמ}}\nסה"כ לתשלום: ₪{{סה_כ}}\n\nלצפייה בחשבונית:\n{{קישור}}\n\nבברכה,\nגיא דינאי — נדלניסטי 360';

export const PREVIEW_VARS: Record<string, string> = {
  שם_לקוח:      "ישראל ישראלי",
  מספר_חשבונית: "INV-2025-042",
  סה_כ:         "5,900",
  לפני_מעמ:     "5,000",
  מעמ:          "900",
  קישור:        "https://www.ezcount.co.il/doc/example",
  חודש_חיוב:    "מאי 2025",
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [key, val]) => t.split(`{{${key}}}`).join(val),
    template
  );
}

export function buildInvoiceEmail(params: {
  subject_template: string | null;
  body_template:    string | null;
  clientName:       string;
  docNumber:        string;
  docUrl:           string;
  subtotal:         number;
  vat:              number;
  total:            number;
  billingMonth?:    string;
}): { subject: string; body: string } {
  const vars: Record<string, string> = {
    שם_לקוח:      params.clientName,
    מספר_חשבונית: params.docNumber,
    סה_כ:         params.total.toLocaleString("he-IL"),
    לפני_מעמ:     params.subtotal.toLocaleString("he-IL"),
    מעמ:          params.vat.toLocaleString("he-IL"),
    קישור:        params.docUrl,
    חודש_חיוב:    params.billingMonth ?? "",
  };

  return {
    subject: renderTemplate(params.subject_template ?? DEFAULT_INVOICE_SUBJECT, vars),
    body:    renderTemplate(params.body_template    ?? DEFAULT_INVOICE_BODY,    vars),
  };
}
