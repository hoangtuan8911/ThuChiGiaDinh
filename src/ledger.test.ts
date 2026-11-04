import { describe, expect, it } from "vitest";
import { addDays, formatInputAmount, isIsoDate, parseAmount, shiftMonth } from "./format";
import {
  adjustBalance,
  createAccount,
  expenseByCategory,
  freshState,
  monthFlow,
  removeAccount,
  removeCategory,
  removeEntry,
  saveCategory,
  saveEntry,
  wealth,
} from "./ledger";
import { buildSample } from "./sample";
import { parseBackup } from "./storage";
import type { State } from "./types";

function must(result: { ok: true; state: State } | { ok: false; error: string }): State {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function account(state: State, name: string) {
  const found = state.accounts.find((item) => item.name === name);
  if (!found) throw new Error(`missing ${name}`);
  return found;
}

describe("format", () => {
  it("parses Vietnamese amounts", () => {
    expect(parseAmount("1.500.000")).toBe(1_500_000);
    expect(parseAmount("-2.000")).toBe(-2_000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-")).toBeNull();
    expect(formatInputAmount("1500000", false)).toBe("1.500.000");
  });

  it("checks calendar dates and month shifts", () => {
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-11-04")).toBe(true);
    expect(addDays("2026-11-04", -3)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("family ledger", () => {
  const state = buildSample("2026-11-04");

  it("keeps the sample household books in balance", () => {
    expect(account(state, "Vietcombank").balance).toBe(69_840_000);
    expect(account(state, "MoMo").balance).toBe(1_892_000);
    expect(account(state, "Techcombank Visa").balance).toBe(1_370_000);
    expect(wealth(state.accounts).net).toBe(70_362_000);
    expect(monthFlow(state.entries, "2026-11")).toEqual({
      income: 28_000_000,
      expense: 1_938_000,
      net: 26_062_000,
    });
    const spent = expenseByCategory(state, "2026-11");
    expect(spent.find((row) => row.name === "Ăn uống")?.total).toBe(893_000);
    expect(spent.find((row) => row.name === "Di chuyển")?.total).toBe(75_000);
    expect(spent.find((row) => row.name === "Nhà cửa")?.total).toBe(850_000);
    expect(spent.find((row) => row.name === "Sức khỏe")?.total).toBe(120_000);
  });

  it("round-trips a backup without changing balances", () => {
    const restored = parseBackup(JSON.stringify(state));
    expect(restored && account(restored, "Vietcombank").balance).toBe(69_840_000);
    expect(restored?.entries.length).toBe(state.entries.length);
  });

  it("moves money between bank and wallet without changing net worth", () => {
    const momo = account(state, "MoMo");
    const vcb = account(state, "Vietcombank");
    const next = must(
      saveEntry(
        state,
        {
          kind: "transfer",
          amount: 500_000,
          date: "2026-11-04",
          accountId: momo.id,
          counterAccountId: vcb.id,
          note: "Rút ví về ngân hàng",
        },
        "2026-11-04T02:00:00.000Z",
      ),
    );
    expect(account(next, "MoMo").balance).toBe(1_392_000);
    expect(account(next, "Vietcombank").balance).toBe(70_340_000);
    expect(wealth(next.accounts).net).toBe(wealth(state.accounts).net);
  });

  it("increases card debt on spend and lowers it on a refund", () => {
    const visa = account(state, "Techcombank Visa");
    const spent = must(
      saveEntry(
        state,
        {
          kind: "expense",
          amount: 1_000,
          date: "2026-11-04",
          accountId: visa.id,
          categoryId: "exp-food-cafe",
          note: "",
        },
        "2026-11-04T02:00:00.000Z",
      ),
    );
    expect(account(spent, "Techcombank Visa").balance).toBe(1_371_000);
    expect(wealth(spent.accounts).net).toBe(wealth(state.accounts).net - 1_000);

    const refunded = must(
      saveEntry(
        spent,
        {
          kind: "income",
          amount: 1_000,
          date: "2026-11-04",
          accountId: visa.id,
          categoryId: "inc-other",
          note: "Hoàn tiền",
        },
        "2026-11-04T03:00:00.000Z",
      ),
    );
    expect(account(refunded, "Techcombank Visa").balance).toBe(1_370_000);
  });

  it("edits and deletes an expense by recomputing the balance", () => {
    const market = state.entries.find((entry) => entry.note === "Đi chợ cuối tuần");
    if (!market) throw new Error("missing market entry");
    const edited = must(
      saveEntry(
        state,
        {
          id: market.id,
          kind: "expense",
          amount: 410_000,
          date: market.date,
          accountId: market.accountId,
          categoryId: market.categoryId,
          note: market.note,
        },
        "2026-11-04T04:00:00.000Z",
      ),
    );
    expect(account(edited, "Vietcombank").balance).toBe(69_740_000);
    const removed = must(removeEntry(edited, market.id));
    expect(account(removed, "Vietcombank").balance).toBe(70_150_000);
  });

  it("sets an exact balance and restores it when the adjustment is removed", () => {
    const vcb = account(state, "Vietcombank");
    const adjusted = must(
      adjustBalance(
        state,
        { accountId: vcb.id, nextBalance: 70_000_000, date: "2026-11-04", note: "Khớp sao kê" },
        "2026-11-04T05:00:00.000Z",
      ),
    );
    expect(account(adjusted, "Vietcombank").balance).toBe(70_000_000);
    const entry = adjusted.entries.find((item) => item.note === "Khớp sao kê");
    if (!entry) throw new Error("missing adjustment");
    const restored = must(removeEntry(adjusted, entry.id));
    expect(account(restored, "Vietcombank").balance).toBe(69_840_000);
  });

  it("keeps the other account when one account is removed", () => {
    const vcb = account(state, "Vietcombank");
    const next = must(removeAccount(state, vcb.id));
    expect(next.accounts.some((item) => item.name === "Vietcombank")).toBe(false);
    expect(account(next, "Techcombank Visa").balance).toBe(1_370_000);
    expect(next.entries.length).toBe(state.entries.length);
  });

  it("rejects a transfer to the same account and an expense without a category", () => {
    const vcb = account(state, "Vietcombank");
    const same = saveEntry(
      state,
      { kind: "transfer", amount: 10_000, date: "2026-11-04", accountId: vcb.id, counterAccountId: vcb.id, note: "" },
      "2026-11-04T06:00:00.000Z",
    );
    expect(same.ok).toBe(false);
    const missing = saveEntry(
      state,
      { kind: "expense", amount: 10_000, date: "2026-11-04", accountId: vcb.id, note: "" },
      "2026-11-04T06:00:00.000Z",
    );
    expect(missing.ok).toBe(false);
  });

  it("removes a parent category and its children but keeps history", () => {
    const removed = must(removeCategory(state, "exp-food"));
    expect(removed.categories.some((category) => category.id === "exp-food" || category.parentId === "exp-food")).toBe(
      false,
    );
    expect(removed.entries.some((entry) => entry.categoryId === "exp-food-market")).toBe(true);
    const blocked = saveCategory(
      state,
      { id: "exp-food", name: "Ăn uống", flow: "expense", color: "#c2410c", parentId: "exp-home" },
      "2026-11-04T07:00:00.000Z",
    );
    expect(blocked.ok).toBe(false);
  });

  it("allows a negative bank balance", () => {
    const opened = must(
      createAccount(
        freshState(),
        {
          name: "Thấu chi",
          kind: "bank",
          institution: "ACB",
          color: "#1d4ed8",
          note: "",
          openingBalance: -50_000,
          creditLimit: null,
          date: "2026-11-04",
        },
        "2026-11-04T08:00:00.000Z",
      ),
    );
    expect(account(opened, "Thấu chi").balance).toBe(-50_000);
  });
});
