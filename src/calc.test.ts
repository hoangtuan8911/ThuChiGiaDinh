import { describe, expect, it } from "vitest";
import { accountSnapshots, backupAgeDays, categorySpend, monthTotals, moveWithinDay, screenOrder } from "./calc";
import { freshData } from "./defaults";
import { normalize } from "./migrate";
import { parseAmount } from "./money";
import { deleteAccount, renameCategory, saveAccount, saveBudgets, saveTransaction } from "./mutate";
import type { AppData, Transaction } from "./types";

function must<T extends { ok: true; data: AppData } | { ok: false; error: string }>(result: T): AppData {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

function tx(partial: Pick<Transaction, "id" | "type" | "date" | "amount" | "accountId"> & Partial<Transaction>): Transaction {
  return {
    category: partial.type === "p" ? "Chuyển khoản" : "Ăn uống",
    sub: "",
    note: "",
    ...partial,
  };
}

describe("parseAmount", () => {
  it("đọc các cách gõ trong đặc tả", () => {
    expect(parseAmount("50k")).toBe(50_000);
    expect(parseAmount("1.5tr")).toBe(1_500_000);
    expect(parseAmount("1,5tr")).toBe(1_500_000);
    expect(parseAmount("150.000")).toBe(150_000);
    expect(parseAmount("150,000")).toBe(150_000);
    expect(parseAmount("150000")).toBe(150_000);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("0")).toBe(0);
  });
});

describe("số dư và thẻ", () => {
  it("khớp ca chấp nhận mục 9", () => {
    let data = freshData();
    data = must(saveAccount(data, { id: "a1", name: "Tài khoản chính", kind: "bank", openingText: "10000000", limitText: "" }));
    data = must(saveAccount(data, { id: "a2", name: "Thẻ tín dụng", kind: "cr", openingText: "0", limitText: "50000000" }));
    const add = (type: "t" | "x" | "p", amount: string, accountId: string, toAccountId = "") => {
      data = must(
        saveTransaction(data, {
          type,
          amountText: amount,
          date: "2026-11-04",
          category: type === "x" ? "Ăn uống" : "Lương",
          sub: "",
          accountId,
          toAccountId,
          note: "",
        }),
      );
    };
    add("t", "30000000", "a1");
    add("x", "2000000", "a1");
    add("x", "5000000", "a2");
    add("p", "3000000", "a1", "a2");
    add("x", "1000000", "a1");

    const snaps = accountSnapshots(data);
    expect(snaps.find((item) => item.account.id === "a1")?.available).toBe(34_000_000);
    expect(snaps.find((item) => item.account.id === "a2")?.debt).toBe(2_000_000);
    expect(snaps.find((item) => item.account.id === "a2")?.available).toBe(48_000_000);
    const month = monthTotals(data.transactions, "2026-11");
    expect(month.income).toBe(30_000_000);
    expect(month.expense).toBe(8_000_000);
  });

  it("tô màu Chi/Thu, còn lại, ngân sách và khả dụng thẻ", () => {
    const warn = monthTotals(
      [tx({ id: 1, type: "t", date: "2026-11-01", amount: 10_000_000, accountId: "a1" }), tx({ id: 2, type: "x", date: "2026-11-02", amount: 9_500_000, accountId: "a1" })],
      "2026-11",
    );
    expect(warn.tone).toBe("warn");
    const bad = monthTotals(
      [tx({ id: 1, type: "t", date: "2026-11-01", amount: 10_000_000, accountId: "a1" }), tx({ id: 2, type: "x", date: "2026-11-02", amount: 10_500_000, accountId: "a1" })],
      "2026-11",
    );
    expect(bad.tone).toBe("bad");
    expect(bad.left).toBeLessThan(0);

    let data = freshData();
    data = must(saveBudgets(data, { "Ăn uống": "1000000" }));
    data = must(saveTransaction(data, { type: "x", amountText: "850000", date: "2026-11-01", category: "Ăn uống", sub: "", accountId: "a1", toAccountId: "", note: "" }));
    expect(categorySpend(data, "2026-11").find((row) => row.name === "Ăn uống")?.tag).toBe("Sát mức");
    data = must(saveTransaction(data, { type: "x", amountText: "350000", date: "2026-11-02", category: "Ăn uống", sub: "", accountId: "a1", toAccountId: "", note: "" }));
    expect(categorySpend(data, "2026-11").find((row) => row.name === "Ăn uống")?.tag).toBe("VƯỢT");

    let card = freshData();
    card = must(saveAccount(card, { id: "a2", name: "Thẻ tín dụng", kind: "cr", openingText: "0", limitText: "10000000" }));
    card = must(saveTransaction(card, { type: "x", amountText: "9000000", date: "2026-11-01", category: "Ăn uống", sub: "", accountId: "a2", toAccountId: "", note: "" }));
    expect(accountSnapshots(card).find((item) => item.account.id === "a2")?.tone).toBe("warn");
    card = must(saveTransaction(card, { type: "x", amountText: "2000000", date: "2026-11-02", category: "Ăn uống", sub: "", accountId: "a2", toAccountId: "", note: "" }));
    expect(accountSnapshots(card).find((item) => item.account.id === "a2")?.tone).toBe("bad");
  });
});

describe("sắp xếp trong ngày", () => {
  const day = [
    tx({ id: 1, type: "x", date: "2026-11-04", amount: 1, accountId: "a1", note: "A" }),
    tx({ id: 2, type: "x", date: "2026-11-04", amount: 1, accountId: "a1", note: "B" }),
    tx({ id: 3, type: "x", date: "2026-11-04", amount: 1, accountId: "a1", note: "C" }),
    tx({ id: 9, type: "x", date: "2026-11-03", amount: 1, accountId: "a1", note: "khác ngày" }),
  ];

  it("hiển thị C, B, A rồi đưa A lên một bậc thành C, A, B", () => {
    expect(screenOrder(day, "2026-11").map((item) => item.note)).toEqual(["C", "B", "A", "khác ngày"]);
    const moved = moveWithinDay(day, 1, -1);
    expect(screenOrder(moved, "2026-11").map((item) => item.note)).toEqual(["C", "A", "B", "khác ngày"]);
    expect(moveWithinDay(moved, 3, -1).map((item) => item.order)).toEqual(moved.map((item) => item.order));
    expect(moved.find((item) => item.note === "khác ngày")?.order).toBeUndefined();
  });
});

describe("danh mục và tài khoản", () => {
  it("đổi tên danh mục kéo theo giao dịch và ngân sách", () => {
    let data = freshData();
    data = must(saveBudgets(data, { "Ăn uống": "1000000" }));
    data = must(saveTransaction(data, { type: "x", amountText: "10000", date: "2026-11-01", category: "Ăn uống", sub: "Cà phê", accountId: "a1", toAccountId: "", note: "" }));
    data = must(renameCategory(data, "expense", "Ăn uống", "Ăn nhậu"));
    expect(data.transactions[0]?.category).toBe("Ăn nhậu");
    expect(data.transactions[0]?.sub).toBe("Cà phê");
    expect(data.budgets["Ăn nhậu"]).toBe(1_000_000);
    expect(data.budgets["Ăn uống"]).toBeUndefined();
    expect(data.categories.expense.find((category) => category.name === "Ăn nhậu")?.subs).toEqual(["Ăn ngoài", "Cà phê"]);
  });

  it("hai tài khoản thêm liền nhau không trùng mã", () => {
    let data = freshData();
    data = must(saveAccount(data, { name: "Ví", kind: "ew", openingText: "0", limitText: "" }));
    data = must(saveAccount(data, { name: "Tiền mặt", kind: "cash", openingText: "0", limitText: "" }));
    const ids = data.accounts.map((account) => account.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("từ chối xóa tài khoản đã có giao dịch và chuyển vào chính nó", () => {
    let data = freshData();
    data = must(saveTransaction(data, { type: "x", amountText: "10000", date: "2026-11-01", category: "Ăn uống", sub: "", accountId: "a1", toAccountId: "", note: "" }));
    expect(deleteAccount(data, "a1").ok).toBe(false);
    const unused = must(saveAccount(data, { name: "Tiền mặt", kind: "cash", openingText: "0", limitText: "" }));
    const cash = unused.accounts.find((account) => account.name === "Tiền mặt");
    expect(cash && deleteAccount(unused, cash.id).ok).toBe(true);
    expect(saveTransaction(data, { type: "p", amountText: "1000", date: "2026-11-01", category: "", sub: "", accountId: "a1", toAccountId: "a1", note: "" }).ok).toBe(false);
  });
});

describe("di trú dữ liệu cũ", () => {
  it("đọc bản HTML rút gọn và khôi phục đúng số", () => {
    const restored = normalize({
      tx: [{ id: 1, t: "x", d: "2026-11-01", a: 1000, c: "Ăn uống", sc: "Cà phê", n: "cafe", src: "c" }],
      bud: [["Ăn uống", 500000]],
      cats: { thu: ["Lương"], chi: [{ n: "Ăn uống", s: ["Cà phê"], c: "#ff0000" }] },
      acc: { open: 10_000_000, debt: 2000, limit: 5_000_000 },
    });
    expect(restored?.accounts.find((account) => account.id === "a1")?.opening).toBe(10_000_000);
    expect(restored?.accounts.find((account) => account.id === "a2")).toMatchObject({ opening: 2000, limit: 5_000_000 });
    expect(restored?.transactions[0]).toMatchObject({ accountId: "a2", category: "Ăn uống", sub: "Cà phê" });
    expect(restored?.budgets["Ăn uống"]).toBe(500_000);
    expect(JSON.parse(JSON.stringify(normalize(JSON.parse(JSON.stringify(restored)))))).toEqual(restored);
  });
});

describe("nhắc sao lưu", () => {
  it("đếm số ngày kể từ lần sao lưu gần nhất", () => {
    expect(backupAgeDays(undefined, "2026-11-04")).toBeNull();
    expect(backupAgeDays("2026-10-01", "2026-11-04")).toBe(34);
  });
});
