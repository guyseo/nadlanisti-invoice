import type { LineItem } from "./types";

export function calcTotals(lines: LineItem[], vatRate: number) {
  const subtotal = lines.reduce((sum, l) => sum + l.amount * (l.quantity ?? 1), 0);
  const vat = Math.round(subtotal * vatRate * 100) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;
  return { subtotal, vat, total };
}
