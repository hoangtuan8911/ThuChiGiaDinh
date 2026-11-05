/** `150000`, `150.000`, `150,000`, `150k`, `1.5tr`, `1,5tr`. Rỗng hoặc không phải số → null. */
export function parseAmount(input: string): number | null {
  let text = String(input).trim().toLowerCase().replace(/\s/g, "");
  if (!text) return null;
  let multiplier = 1;
  if (text.endsWith("tr")) {
    multiplier = 1_000_000;
    text = text.slice(0, -2);
  } else if (text.endsWith("k")) {
    multiplier = 1_000;
    text = text.slice(0, -1);
  }
  text = multiplier > 1 ? text.replace(",", ".") : text.replace(/[.,]/g, "");
  if (!text || text === "-" || text === "+" || text === ".") return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  const amount = Math.round(value * multiplier);
  if (!Number.isSafeInteger(amount)) return null;
  return amount;
}

export function formatVnd(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}

export function formatDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function formatFullDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(year, mon - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const [year, mon] = month.split("-");
  return `Tháng ${Number(mon)}/${year}`;
}

/** ISO datetime (vd: lúc build, có "Z" hoặc giờ UTC) → "yyyy-mm-dd HH:mm:ss" theo giờ máy đang xem. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
