import { describe, expect, it } from "vitest";
import { bookHasEntries, storageNotice } from "./browserNotice";

const base = { canWrite: true, inApp: false, ios: true, chrome: false, standalone: false, hasEntries: false };

describe("cảnh báo sổ riêng trên iPhone", () => {
  it("Chrome và icon là hai sổ", () => {
    expect(storageNotice({ ...base, chrome: true })).toMatch(/nằm trong Chrome/);
  });

  it("icon trống thì hướng dẫn khôi phục từ Chrome", () => {
    expect(storageNotice({ ...base, standalone: true, hasEntries: false })).toMatch(/Icon này là sổ riêng/);
    expect(storageNotice({ ...base, standalone: true, hasEntries: true })).toBeNull();
  });

  it("Safari cũng không dùng chung sổ với icon", () => {
    expect(storageNotice(base)).toMatch(/hai sổ khác nhau/);
  });

  it("máy tính không hiện cảnh báo này", () => {
    expect(storageNotice({ ...base, ios: false, chrome: true })).toBeNull();
  });

  it("nhận ra sổ đã có giao dịch", () => {
    expect(bookHasEntries(null)).toBe(false);
    expect(bookHasEntries("{")).toBe(false);
    expect(bookHasEntries(JSON.stringify({ transactions: [] }))).toBe(false);
    expect(bookHasEntries(JSON.stringify({ transactions: [{ id: 1 }] }))).toBe(true);
  });
});
