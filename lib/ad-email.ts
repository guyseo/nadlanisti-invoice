// Email template for forwarding ad-platform invoices (separate from the
// invoice/report templates — this is a different product).

export const DEFAULT_AD_EMAIL_SUBJECT = "חשבונית {{platform}} — {{month}}";

export const DEFAULT_AD_EMAIL_BODY = `שלום {{client_name}},

מצורפת חשבונית {{platform}} עבור חודש {{month}}.

בברכה,
נדלניסטי`;

export const AD_EMAIL_PLACEHOLDERS = [
  { key: "client_name", desc: "שם הלקוח" },
  { key: "platform", desc: "פלטפורמה (פייסבוק / גוגל)" },
  { key: "month", desc: "חודש החיוב" },
];

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: "פייסבוק",
  google: "גוגל",
};

export function renderAdTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}
