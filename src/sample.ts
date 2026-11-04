import { addDays, monthStart } from "./format";
import { createAccount, freshState, saveEntry, type Result } from "./ledger";
import type { EntryInput, Flow, NewAccountInput, State } from "./types";

function apply(state: State, result: Result): State {
  return result.ok ? result.state : state;
}

function pickCategory(state: State, id: string, flow: Flow): string | null {
  if (state.categories.some((category) => category.id === id)) return id;
  return state.categories.find((category) => category.flow === flow)?.id ?? null;
}

/** Sổ mẫu một gia đình trong tháng của `now`, để xem cách thu chi chạy. */
export function buildSample(now: string, base: State = freshState()): State {
  let state: State = {
    ...base,
    accounts: [...base.accounts],
    categories: base.categories.length ? [...base.categories] : freshState().categories,
    entries: [...base.entries],
  };
  if (state.accounts.length > 0) return state;

  let tick = 0;
  const stamp = () => {
    const [y, m, d] = now.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 1, 0, tick++)).toISOString();
  };
  const on = (offset: number): string | null => {
    const date = addDays(monthStart(now), offset);
    return date <= now ? date : null;
  };
  const openingDate = on(0) ?? now;

  const open = (input: NewAccountInput) => {
    state = apply(state, createAccount(state, input, stamp()));
  };
  const add = (date: string | null, input: Omit<EntryInput, "date">) => {
    if (!date) return;
    state = apply(state, saveEntry(state, { ...input, date }, stamp()));
  };
  const idOf = (name: string) => state.accounts.find((account) => account.name === name)?.id ?? "";

  open({
    name: "Vietcombank",
    kind: "bank",
    institution: "Vietcombank",
    color: "#1d4ed8",
    note: "",
    openingBalance: 45_000_000,
    creditLimit: null,
    date: openingDate,
  });
  open({
    name: "MoMo",
    kind: "ewallet",
    institution: "MoMo",
    color: "#a21caf",
    note: "",
    openingBalance: 2_500_000,
    creditLimit: null,
    date: openingDate,
  });
  open({
    name: "Techcombank Visa",
    kind: "credit",
    institution: "Techcombank",
    color: "#c2410c",
    note: "",
    openingBalance: 3_200_000,
    creditLimit: 30_000_000,
    date: openingDate,
  });

  const vcb = idOf("Vietcombank");
  const momo = idOf("MoMo");
  const visa = idOf("Techcombank Visa");
  const income = (id: string) => pickCategory(state, id, "income");
  const expense = (id: string) => pickCategory(state, id, "expense");

  const salary = income("inc-salary-main");
  if (salary) {
    add(on(0), {
      kind: "income",
      amount: 28_000_000,
      accountId: vcb,
      categoryId: salary,
      note: "Lương tháng",
    });
  }

  const market = expense("exp-food-market");
  const util = expense("exp-home-util");
  const ride = expense("exp-move-ride");
  const cafe = expense("exp-food-cafe");
  const meds = expense("exp-health-meds");
  const eatOut = expense("exp-food-out");

  if (market) add(on(1), { kind: "expense", amount: 420_000, accountId: momo, categoryId: market, note: "Chợ Bến Thành" });
  if (util) add(on(1), { kind: "expense", amount: 850_000, accountId: vcb, categoryId: util, note: "Tiền điện" });
  if (ride) add(on(2), { kind: "expense", amount: 75_000, accountId: visa, categoryId: ride, note: "Đi làm" });
  if (cafe) add(on(2), { kind: "expense", amount: 68_000, accountId: momo, categoryId: cafe, note: "Cafe cuối tuần" });
  add(on(2), {
    kind: "transfer",
    amount: 2_000_000,
    accountId: vcb,
    counterAccountId: visa,
    note: "Thanh toán thẻ",
  });
  if (market) add(on(3), { kind: "expense", amount: 310_000, accountId: vcb, categoryId: market, note: "Đi chợ cuối tuần" });
  if (meds) add(on(3), { kind: "expense", amount: 120_000, accountId: momo, categoryId: meds, note: "Nhà thuốc" });
  if (eatOut) add(on(3), { kind: "expense", amount: 95_000, accountId: visa, categoryId: eatOut, note: "Cơm trưa" });

  return state;
}
