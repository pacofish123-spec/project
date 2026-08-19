export function formatDate(value: string, locale = "en-US"): string {
  return new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${Number(amount).toFixed(2)}`;
}
