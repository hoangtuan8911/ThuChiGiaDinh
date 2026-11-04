/** "Hôm nay" theo giờ Việt Nam, vì sổ dùng cho gia đình ở múi giờ này. */
export const TIME_ZONE = "Asia/Saigon";

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentMonth(now = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function monthStart(isoOrMonth: string): string {
  return `${isoOrMonth.slice(0, 7)}-01`;
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12));
  return dt.toISOString().slice(0, 10);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function utcNoon(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function formatMonth(ym: string): string {
  const label = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utcNoon(monthStart(ym)));
  return capitalize(label);
}

export function formatLongDate(iso: string, today = todayISO()): string {
  const label = capitalize(
    new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(utcNoon(iso)),
  );
  if (iso === today) return `Hôm nay · ${label}`;
  if (iso === addDays(today, -1)) return `Hôm qua · ${label}`;
  return label;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function formatVnd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toLocaleString("vi-VN");
  return `${rounded < 0 ? "−" : ""}${abs} ₫`;
}

export function parseAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value)) return null;
  return negative ? -value : value;
}

export function formatInputAmount(raw: string, allowNegative: boolean): string {
  const negative = allowNegative && raw.trim().startsWith("-");
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return negative ? "-" : "";
  const formatted = Number(digits).toLocaleString("vi-VN");
  return `${negative ? "-" : ""}${formatted}`;
}
