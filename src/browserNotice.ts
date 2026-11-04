export interface NoticeInput {
  canWrite: boolean;
  inApp: boolean;
  ios: boolean;
  chrome: boolean;
  standalone: boolean;
  hasEntries: boolean;
}

/** Chrome, Safari và icon Màn hình chính trên iPhone là ba sổ riêng. */
export function storageNotice(input: NoticeInput): string | null {
  if (!input.canWrite) {
    return "Máy không cho lưu sổ. Hãy tắt tab Riêng tư. Chrome và icon Màn hình chính là hai sổ khác nhau.";
  }
  if (input.inApp) {
    return "Đang mở trong ứng dụng khác. Sổ ở đây không phải sổ trong Chrome. Hãy Sao lưu file JSON rồi Khôi phục ở Chrome hoặc ở icon.";
  }
  if (!input.ios) return null;
  if (input.chrome && !input.standalone) {
    return "Sổ này nằm trong Chrome. Icon Màn hình chính là sổ khác, mở icon sẽ trống. Hãy bấm Sao lưu ở đây, rồi mở icon và bấm Khôi phục.";
  }
  if (input.standalone && !input.hasEntries) {
    return "Icon này là sổ riêng, không thấy sổ trong Chrome. Mở Chrome, bấm Sao lưu, rồi ở đây bấm Khôi phục.";
  }
  if (!input.standalone) {
    return "Safari và icon Màn hình chính là hai sổ khác nhau. Hãy Sao lưu file JSON nếu muốn đưa sổ sang icon.";
  }
  return null;
}

export function bookHasEntries(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as { transactions?: unknown };
    return Array.isArray(data.transactions) && data.transactions.length > 0;
  } catch {
    return false;
  }
}
