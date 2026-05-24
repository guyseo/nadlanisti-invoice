export type BillingType = "fixed" | "media_commission" | "auto_cc";
export type EmailDeliveryMode = "combined" | "separate";
export type DraftStatus =
  | "pending_review"
  | "approved"
  | "sent"
  | "failed"
  | "skipped"
  | "invoiced_pending_combined"
  | "invoiced_email_failed";
export type EmailType = "monthly_report" | "invoice" | "combined" | "media_invoices" | "manual";
export type Platform = "google_ads" | "facebook_ads";

export const DocType = {
  PROFORMA: 300,
  TAX_INVOICE: 305,
  TAX_RECEIPT: 320,
  RECEIPT: 400,
} as const;

export type DocTypeValue = (typeof DocType)[keyof typeof DocType];

export interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
}

export interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface EmailPreviewData {
  draftId: string;
  clientEmail: string;
  clientName: string;
  subject: string;
  body: string;
}

export const DOC_TYPE_LABELS: Record<number, string> = {
  300: "חשבונית עסקה",
  305: "חשבונית מס",
  320: "חשבונית מס קבלה",
  400: "קבלה",
};

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  fixed: "ריטיינר קבוע",
  media_commission: "עמלת מדיה",
  auto_cc: "אשראי אוטומטי",
};

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  pending_review: "ממתין לאישור",
  approved: "אושר",
  sent: "נשלח",
  failed: "נכשל",
  skipped: "דולג",
  invoiced_pending_combined: "חשבונית נוצרה - ממתין לדוח",
  invoiced_email_failed: "חשבונית נוצרה - שליחת מייל נכשלה",
};
