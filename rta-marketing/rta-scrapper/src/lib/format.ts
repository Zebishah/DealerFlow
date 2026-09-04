export function formatMoney(cents: number | null): string {
  return cents === null
    ? "Price unavailable"
    : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-CA").format(value);
}

export function formatRelativeTime(value: string | null, now = Date.now()): string {
  if (!value) return "No run yet";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
