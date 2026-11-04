import { describe, expect, it } from "vitest";
import { freshData } from "./defaults";
import { pickNewer, storedBookFromMirror } from "./storage";
import type { AppData } from "./types";

function withTransaction(amount: number): AppData {
  const data = freshData();
  data.transactions = [
    { id: 1, type: "x", date: "2026-11-04", amount, category: "Ăn uống", accountId: "a1" },
  ];
  return data;
}

describe("bản lưu bền hơn", () => {
  it("lấy sổ trong IndexedDB khi Safari đã xóa bộ nhớ tạm", () => {
    const kept = withTransaction(50_000);
    const chosen = pickNewer({ data: freshData(), revision: 0 }, { data: kept, revision: 4 });
    expect(chosen.data.transactions).toEqual(kept.transactions);
    expect(chosen.revision).toBe(4);
  });

  it("giữ sổ đang mở khi hai bản cùng lần lưu, kể cả sổ đang mở ít giao dịch hơn", () => {
    const current = freshData();
    const olderCopy = withTransaction(50_000);
    const chosen = pickNewer({ data: current, revision: 3 }, { data: olderCopy, revision: 3 });
    expect(chosen.data.transactions).toEqual([]);
    expect(chosen.revision).toBe(3);
  });

  it("không lấy bản cũ hơn", () => {
    const current = withTransaction(20_000);
    const older = withTransaction(50_000);
    const chosen = pickNewer({ data: current, revision: 5 }, { data: older, revision: 2 });
    expect(chosen.data.transactions[0]?.amount).toBe(20_000);
  });

  it("đọc bản IndexedDB cũ không có số lần lưu", () => {
    const saved = withTransaction(70_000);
    const mirror = storedBookFromMirror(saved);
    expect(mirror?.revision).toBe(1);
    expect(pickNewer({ data: freshData(), revision: 0 }, mirror).data.transactions[0]?.amount).toBe(70_000);
  });

  it("đọc bản có số lần lưu và bỏ qua dữ liệu hỏng", () => {
    const saved = withTransaction(15_000);
    expect(storedBookFromMirror({ revision: 6, data: saved })?.revision).toBe(6);
    expect(storedBookFromMirror({ revision: 6, data: { no: "book" } })).toBeNull();
    expect(storedBookFromMirror(null)).toBeNull();
  });
});
