const PG_ERRORS: Record<string, string> = {
  "23505": "הרשומה כבר קיימת במערכת",
  "23503": "לא ניתן למחוק — קיימות רשומות מקושרות",
  "23502": "שדה חובה חסר",
  "42501": "אין הרשאה לפעולה זו",
  "08006": "שגיאת חיבור למסד הנתונים",
};

export function dbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "שגיאה לא ידועה";
  return PG_ERRORS[error.code ?? ""] ?? "שגיאה בשמירה — נסה שוב";
}
