import type { LineItem } from "./types";

const EZCOUNT_URL = "https://www.ezcount.co.il/api/createDoc";

interface EZCountItem {
  details: string;
  amount: number;
  quantity: number;
  price: number;
}

interface CreateDocParams {
  apiKey: string;
  apiEmail: string;
  clientName: string;
  ezCountCustomerName?: string | null;
  clientEmail: string;
  ezCountClientId?: string | null;
  docType: number;
  lines: LineItem[];
  vatRate: number;
}

interface EZCountResponse {
  success: boolean;
  doc_number?: string;
  doc_url?: string;
  error_message?: string;
}

export async function createEZCountDoc(params: CreateDocParams): Promise<{ docNumber: string; docUrl: string }> {
  const items: EZCountItem[] = params.lines.map((l) => ({
    details: l.description,
    amount: l.amount * (l.quantity ?? 1),
    quantity: l.quantity ?? 1,
    price: l.amount,
  }));

  const customerName = params.ezCountCustomerName?.trim() || params.clientName;

  const body = new URLSearchParams({
    api_key:             params.apiKey,
    api_email:           params.apiEmail,
    doc_type:            String(params.docType),
    customer_name:       customerName,
    customer_email:      params.clientEmail,
    lang:                "he",
    send_email_original: "false",
    vat_type:            "1",
  });

  if (params.ezCountClientId) {
    body.set("customer_id", params.ezCountClientId);
  }

  items.forEach((item, i) => {
    body.set(`item[${i}][details]`,  item.details);
    body.set(`item[${i}][quantity]`, String(item.quantity));
    body.set(`item[${i}][price]`,    String(item.price));
    body.set(`item[${i}][amount]`,   String(item.amount));
  });

  const res = await fetch(EZCOUNT_URL, {
    method: "POST",
    body,
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`EZCount HTTP ${res.status}: ${rawText.slice(0, 300)}`);
  }

  let json: EZCountResponse;
  try {
    json = JSON.parse(rawText) as EZCountResponse;
  } catch {
    throw new Error(`EZCount תגובה לא תקינה: ${rawText.slice(0, 300)}`);
  }

  if (!json.success) {
    throw new Error(json.error_message ?? `EZCount נכשל (תגובה: ${rawText.slice(0, 300)})`);
  }

  return {
    docNumber: json.doc_number ?? "",
    docUrl:    json.doc_url ?? "",
  };
}
