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

/** `1,5` hoặc `50t` là đang gõ dở, chưa phải số tiền chốt. */
export function isAmountDraft(input: string): boolean {
  const text = input.trim().toLowerCase();
  if (!text) return false;
  if (text.endsWith("t") && !text.endsWith("tr")) return true;
  return /^\d{1,3}(\.\d{3})*[.,]\d{0,2}$/.test(text) || /^\d+[.,]\d{0,2}$/.test(text);
}

/**
 * Số đang gõ. `1500000` → `1.500.000`. `50k` và `1,5tr` đổi thành số có chấm.
 * `1,5` giữ lại để bấm triệu. `previous` giúp xóa một số không biến `1.500` thành `1,50`.
 */
export function formatAmountTyping(input: string, previous = ""): string {
  const compact = String(input).trim().toLowerCase().replace(/\s/g, "");
  if (!compact) return "";
  const suffix = compact.endsWith("tr") ? "tr" : compact.endsWith("k") ? "k" : compact.endsWith("t") ? "t" : "";
  const body = suffix ? compact.slice(0, -suffix.length) : compact;

  if (suffix === "k" || suffix === "tr") {
    const amount = amountWithShortcut(body, suffix);
    if (amount === null || amount <= 0) return "";
    return groupDigits(String(amount));
  }
  if (suffix === "t") {
    if (isGroupedInteger(body) || /^\d+$/.test(body)) {
      const whole = groupDigits(body.replace(/\./g, ""));
      return whole ? `${whole}t` : "";
    }
    const decimal = body.match(/^(\d*)[.,](\d{0,2})$/);
    if (!decimal) return "";
    const whole = groupDigits(decimal[1] || "");
    return `${whole || "0"}${decimal[2] !== "" ? "," + decimal[2] : ","}t`;
  }

  if (
    isGroupedInteger(previous) &&
    !/[ktr,]/i.test(compact) &&
    digitsOnly(previous).length === digitsOnly(compact).length + 1
  ) {
    return groupDigits(digitsOnly(compact));
  }

  const draft = compact.match(/^(\d*)[.,](\d{0,2})$/);
  if (draft) return `${groupDigits(draft[1] || "")},${draft[2]}`;
  return groupDigits(digitsOnly(compact));
}

/** Gõ hoặc xóa trong ô tiền. Xóa đúng dấu chấm nghìn thì xóa luôn chữ số đứng trước nó. */
export function editAmount(previous: string, raw: string, cursor: number): { text: string; cursor: number } {
  const safeCursor = Math.max(0, Math.min(cursor, raw.length));
  let source = raw;
  let sourceCursor = safeCursor;
  const deletedDot =
    previous.includes(".") &&
    !previous.includes(",") &&
    !raw.includes(",") &&
    raw.length < previous.length &&
    digitsOnly(previous) === digitsOnly(raw);

  if (deletedDot) {
    const cutAt = digitsOnly(raw.slice(0, safeCursor)).length - 1;
    if (cutAt >= 0) {
      const digits = digitsOnly(previous);
      source = digits.slice(0, cutAt) + digits.slice(cutAt + 1);
      sourceCursor = cutAt;
    }
  }

  const text = formatAmountTyping(source, deletedDot ? "" : previous);
  return { text, cursor: cursorInFormatted(text, source, sourceCursor) };
}

/** `000` thêm ba số 0. `k` nhân 1.000. `tr` nhân 1.000.000. Ô trống thì nghìn = 1.000, triệu = 1.000.000. */
export function bumpAmount(current: string, kind: "000" | "k" | "tr"): string {
  const text = current.trim().toLowerCase();
  if (kind === "000") {
    const digits = digitsOnly(text).replace(/^0+(?=\d)/, "");
    if (!digits) return "";
    const next = Number(digits + "000");
    if (!Number.isSafeInteger(next)) return current;
    return groupDigits(String(next));
  }
  if (!text || text === "0") return groupDigits(kind === "k" ? "1000" : "1000000");
  const amount = amountWithShortcut(stripShortcut(text), kind === "k" ? "k" : "tr");
  if (amount === null || amount <= 0) return current;
  return groupDigits(String(amount));
}

function stripShortcut(text: string): string {
  if (text.endsWith("tr")) return text.slice(0, -2);
  if (text.endsWith("k") || text.endsWith("t")) return text.slice(0, -1);
  return text;
}

function amountWithShortcut(body: string, suffix: "k" | "tr"): number | null {
  const factor = suffix === "k" ? 1_000 : 1_000_000;
  if (body.includes(",") || /^\d*[.]\d{1,2}$/.test(body)) {
    const parsed = parseAmount(`${body}${suffix}`);
    return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
  }
  const base = Number(digitsOnly(body));
  if (!Number.isSafeInteger(base)) return null;
  const amount = base * factor;
  return Number.isSafeInteger(amount) ? amount : null;
}

function isGroupedInteger(value: string): boolean {
  return /^\d{1,3}(\.\d{3})*$/.test(value);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function groupDigits(digits: string): string {
  const trimmed = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!trimmed) return "";
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function cursorInFormatted(formatted: string, source: string, cursor: number): number {
  const before = source.slice(0, Math.max(0, Math.min(cursor, source.length))).toLowerCase();
  if (/[.,]$/.test(before)) {
    const comma = formatted.indexOf(",");
    if (comma >= 0) return comma + 1;
  }
  if (/(?:tr|k|t)$/.test(before)) return formatted.length;
  const count = digitsOnly(before).length;
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return formatted.length;
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

/** ISO datetime → "dd/mm/yyyy HH:mm" theo giờ máy đang xem. */
export function formatSyncTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
