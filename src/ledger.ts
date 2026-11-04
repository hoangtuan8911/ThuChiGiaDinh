import { DEFAULT_CATEGORIES } from "./defaults";
import { isIsoDate } from "./format";
import type {
  Account,
  AccountKind,
  AccountPatch,
  AdjustInput,
  Category,
  CategoryInput,
  Entry,
  EntryInput,
  Flow,
  NewAccountInput,
  State,
} from "./types";

/** Trần một nghìn tỷ đồng — đủ cho sổ gia đình, chặn số nhập nhầm. */
const MAX_AMOUNT = 1_000_000_000_000;

export type Result = { ok: true; state: State } | { ok: false; error: string };

export interface PresentedEntry {
  title: string;
  subtitle: string;
  color: string;
  accountName: string;
  counterAccountName: string | null;
}

export interface CategoryTotal {
  id: string;
  name: string;
  color: string;
  total: number;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ok(state: State): Result {
  return { ok: true, state };
}

function fail(error: string): Result {
  return { ok: false, error };
}

function amountError(value: number, label: string): string | null {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) return `${label} không hợp lệ.`;
  if (Math.abs(value) > MAX_AMOUNT) return `${label} quá lớn.`;
  return null;
}

/**
 * Tiền đi vào tài khoản làm số dư tăng.
 * Với thẻ, "đi vào" là trả nợ hoặc hoàn tiền nên dư nợ giảm.
 */
export function movement(kind: AccountKind, direction: "in" | "out", amount: number): number {
  if (kind === "credit") return direction === "in" ? -amount : amount;
  return direction === "in" ? amount : -amount;
}

export function entryDeltas(accounts: Account[], entry: Entry): Map<string, number> {
  const deltas = new Map<string, number>();
  const add = (id: string | null | undefined, delta: number) => {
    if (!id || !accounts.some((account) => account.id === id)) return;
    deltas.set(id, (deltas.get(id) ?? 0) + delta);
  };

  if (entry.kind === "adjustment") {
    add(entry.accountId, (entry.balanceAfter ?? 0) - (entry.balanceBefore ?? 0));
    return deltas;
  }

  if (entry.kind === "transfer") {
    const source = accounts.find((account) => account.id === entry.accountId);
    const dest = accounts.find((account) => account.id === entry.counterAccountId);
    if (source) add(source.id, movement(source.kind, "out", entry.amount));
    if (dest) add(dest.id, movement(dest.kind, "in", entry.amount));
    return deltas;
  }

  const account = accounts.find((item) => item.id === entry.accountId);
  if (!account) return deltas;
  add(account.id, movement(account.kind, entry.kind === "income" ? "in" : "out", entry.amount));
  return deltas;
}

export function withBalances(state: State): State {
  const totals = new Map(state.accounts.map((account) => [account.id, 0]));
  const entries = [...state.entries].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
  });
  for (const entry of entries) {
    for (const [id, delta] of entryDeltas(state.accounts, entry)) {
      totals.set(id, (totals.get(id) ?? 0) + delta);
    }
  }
  return {
    ...state,
    accounts: state.accounts.map((account) => ({
      ...account,
      balance: totals.get(account.id) ?? 0,
    })),
  };
}

export function freshState(): State {
  return {
    version: 1,
    accounts: [],
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    entries: [],
  };
}

export function wealth(accounts: Account[]): { cash: number; debt: number; net: number } {
  let cash = 0;
  let debt = 0;
  for (const account of accounts) {
    if (account.kind === "credit") debt += account.balance;
    else cash += account.balance;
  }
  return { cash, debt, net: cash - debt };
}

export function monthFlow(entries: Entry[], month: string): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const entry of entries) {
    if (!entry.date.startsWith(month)) continue;
    if (entry.kind === "income") income += entry.amount;
    if (entry.kind === "expense") expense += entry.amount;
  }
  return { income, expense, net: income - expense };
}

export function expenseByCategory(state: State, month: string): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();
  for (const entry of state.entries) {
    if (entry.kind !== "expense" || !entry.date.startsWith(month)) continue;
    const category = state.categories.find((item) => item.id === entry.categoryId);
    const root = category?.parentId
      ? (state.categories.find((item) => item.id === category.parentId) ?? category)
      : category;
    const id = root?.id ?? "none";
    const current = totals.get(id) ?? {
      id,
      name: root?.name ?? entry.categoryName ?? "Không danh mục",
      color: root?.color ?? entry.categoryColor ?? "#57534e",
      total: 0,
    };
    current.total += entry.amount;
    totals.set(id, current);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
}

export function presentEntry(state: State, entry: Entry): PresentedEntry {
  const account = state.accounts.find((item) => item.id === entry.accountId);
  const counter = entry.counterAccountId
    ? state.accounts.find((item) => item.id === entry.counterAccountId)
    : undefined;
  const category = entry.categoryId
    ? state.categories.find((item) => item.id === entry.categoryId)
    : undefined;
  const parent = category?.parentId
    ? state.categories.find((item) => item.id === category.parentId)
    : undefined;
  const accountName = account?.name ?? entry.accountName;
  const counterAccountName = entry.counterAccountId
    ? (counter?.name ?? entry.counterAccountName ?? "tài khoản đã xóa")
    : null;

  if (entry.kind === "adjustment") {
    return {
      title: "Điều chỉnh số dư",
      subtitle: [accountName, entry.note].filter(Boolean).join(" · "),
      color: account?.color ?? entry.categoryColor ?? "#57534e",
      accountName,
      counterAccountName,
    };
  }

  if (entry.kind === "transfer") {
    const route = `${accountName} → ${counterAccountName ?? "tài khoản đã xóa"}`;
    return {
      title: "Chuyển tiền",
      subtitle: entry.note ? `${route} · ${entry.note}` : route,
      color: account?.color ?? "#57534e",
      accountName,
      counterAccountName,
    };
  }

  const title = category
    ? parent
      ? `${parent.name} · ${category.name}`
      : category.name
    : (entry.categoryName ?? "Không danh mục");
  return {
    title,
    subtitle: [accountName, entry.note].filter(Boolean).join(" · "),
    color: category?.color ?? entry.categoryColor ?? "#57534e",
    accountName,
    counterAccountName,
  };
}

export function matchesCategory(categories: Category[], entry: Entry, categoryId: string): boolean {
  if (!categoryId) return true;
  if (entry.categoryId === categoryId) return true;
  const selected = categories.find((category) => category.id === categoryId);
  if (!selected || selected.parentId) return false;
  const child = categories.find((category) => category.id === entry.categoryId);
  return child?.parentId === categoryId;
}

export function createAccount(state: State, input: NewAccountInput, timestamp: string): Result {
  const name = input.name.trim().slice(0, 60);
  if (!name) return fail("Nhập tên tài khoản.");
  const balanceError = amountError(input.openingBalance, input.kind === "credit" ? "Dư nợ" : "Số dư");
  if (balanceError) return fail(balanceError);
  if (input.kind === "credit" && input.openingBalance < 0) return fail("Dư nợ không được âm.");
  if (input.creditLimit != null) {
    const limitError = amountError(input.creditLimit, "Hạn mức");
    if (limitError) return fail(limitError);
    if (input.creditLimit < 0) return fail("Hạn mức không được âm.");
  }
  if (!isIsoDate(input.date)) return fail("Ngày không hợp lệ.");

  const account: Account = {
    id: createId(),
    name,
    kind: input.kind,
    institution: input.institution.trim().slice(0, 60),
    balance: 0,
    creditLimit: input.kind === "credit" ? input.creditLimit : null,
    color: normalizeColor(input.color),
    note: input.note.trim().slice(0, 280),
    createdAt: timestamp,
  };

  const entries = [...state.entries];
  if (input.openingBalance !== 0) {
    entries.push({
      id: createId(),
      kind: "adjustment",
      amount: Math.abs(input.openingBalance),
      accountId: account.id,
      accountName: account.name,
      counterAccountId: null,
      counterAccountName: null,
      categoryId: null,
      categoryName: null,
      categoryColor: account.color,
      note: "Số dư ban đầu",
      date: input.date,
      createdAt: timestamp,
      balanceBefore: 0,
      balanceAfter: input.openingBalance,
    });
  }

  return ok(withBalances({ ...state, accounts: [...state.accounts, account], entries }));
}

export function updateAccount(state: State, input: AccountPatch): Result {
  const name = input.name.trim().slice(0, 60);
  if (!name) return fail("Nhập tên tài khoản.");
  const current = state.accounts.find((account) => account.id === input.id);
  if (!current) return fail("Không tìm thấy tài khoản.");
  if (current.kind === "credit" && input.creditLimit != null) {
    const limitError = amountError(input.creditLimit, "Hạn mức");
    if (limitError) return fail(limitError);
    if (input.creditLimit < 0) return fail("Hạn mức không được âm.");
  }

  const accounts = state.accounts.map((account) =>
    account.id === current.id
      ? {
          ...account,
          name,
          institution: input.institution.trim().slice(0, 60),
          color: normalizeColor(input.color),
          note: input.note.trim().slice(0, 280),
          creditLimit: account.kind === "credit" ? input.creditLimit : null,
        }
      : account,
  );
  const entries = state.entries.map((entry) => ({
    ...entry,
    accountName: entry.accountId === current.id ? name : entry.accountName,
    counterAccountName: entry.counterAccountId === current.id ? name : entry.counterAccountName,
  }));
  return ok(withBalances({ ...state, accounts, entries }));
}

export function removeAccount(state: State, id: string): Result {
  if (!state.accounts.some((account) => account.id === id)) return fail("Không tìm thấy tài khoản.");
  return ok(withBalances({ ...state, accounts: state.accounts.filter((account) => account.id !== id) }));
}

export function adjustBalance(state: State, input: AdjustInput, timestamp: string): Result {
  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!account) return fail("Không tìm thấy tài khoản.");
  const label = account.kind === "credit" ? "Dư nợ" : "Số dư";
  const balanceError = amountError(input.nextBalance, label);
  if (balanceError) return fail(balanceError);
  if (account.kind === "credit" && input.nextBalance < 0) return fail("Dư nợ không được âm.");
  if (!isIsoDate(input.date)) return fail("Ngày không hợp lệ.");

  if (input.entryId) {
    const existing = state.entries.find((entry) => entry.id === input.entryId);
    if (!existing || existing.kind !== "adjustment" || existing.accountId !== account.id) {
      return fail("Không sửa được dòng điều chỉnh này.");
    }
    const before = existing.balanceBefore ?? 0;
    const entries = state.entries.map((entry) =>
      entry.id === existing.id
        ? {
            ...entry,
            date: input.date,
            note: input.note.trim().slice(0, 280) || "Điều chỉnh số dư",
            balanceAfter: input.nextBalance,
            amount: Math.abs(input.nextBalance - before),
          }
        : entry,
    );
    return ok(withBalances({ ...state, entries }));
  }

  if (input.nextBalance === account.balance) return fail("Số dư mới trùng số dư hiện tại.");
  const entry: Entry = {
    id: createId(),
    kind: "adjustment",
    amount: Math.abs(input.nextBalance - account.balance),
    accountId: account.id,
    accountName: account.name,
    counterAccountId: null,
    counterAccountName: null,
    categoryId: null,
    categoryName: null,
    categoryColor: account.color,
    note: input.note.trim().slice(0, 280) || "Điều chỉnh số dư",
    date: input.date,
    createdAt: timestamp,
    balanceBefore: account.balance,
    balanceAfter: input.nextBalance,
  };
  return ok(withBalances({ ...state, entries: [...state.entries, entry] }));
}

export function saveCategory(state: State, input: CategoryInput, timestamp: string): Result {
  const name = input.name.trim().slice(0, 40);
  if (!name) return fail("Nhập tên danh mục.");
  if (!isColor(input.color)) return fail("Chọn màu cho danh mục.");

  if (input.id) {
    const current = state.categories.find((category) => category.id === input.id);
    if (!current) return fail("Không tìm thấy danh mục.");
    const parentError = validateParent(state, current.id, input.parentId, current.flow);
    if (parentError) return fail(parentError);
    const categories = state.categories.map((category) =>
      category.id === current.id
        ? { ...category, name, color: input.color.toLowerCase(), parentId: input.parentId }
        : category,
    );
    return ok({ ...state, categories });
  }

  const parentError = validateParent(state, null, input.parentId, input.flow);
  if (parentError) return fail(parentError);
  const category: Category = {
    id: createId(),
    name,
    flow: input.flow,
    color: input.color.toLowerCase(),
    parentId: input.parentId,
    createdAt: timestamp,
  };
  return ok({ ...state, categories: [...state.categories, category] });
}

export function removeCategory(state: State, id: string): Result {
  if (!state.categories.some((category) => category.id === id)) return fail("Không tìm thấy danh mục.");
  const drop = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of state.categories) {
      if (category.parentId && drop.has(category.parentId) && !drop.has(category.id)) {
        drop.add(category.id);
        grew = true;
      }
    }
  }
  return ok({ ...state, categories: state.categories.filter((category) => !drop.has(category.id)) });
}

export function saveEntry(state: State, input: EntryInput, timestamp: string): Result {
  const amountErrorMessage = amountError(input.amount, "Số tiền");
  if (amountErrorMessage) return fail(amountErrorMessage);
  if (input.amount <= 0) return fail("Số tiền phải lớn hơn 0.");
  if (!isIsoDate(input.date)) return fail("Ngày không hợp lệ.");

  const account = state.accounts.find((item) => item.id === input.accountId);
  if (!account) return fail("Chọn tài khoản.");

  let counter: Account | undefined;
  let category: Category | undefined;
  if (input.kind === "transfer") {
    counter = state.accounts.find((item) => item.id === input.counterAccountId);
    if (!counter) return fail("Chọn tài khoản nhận.");
    if (counter.id === account.id) return fail("Hai tài khoản phải khác nhau.");
  } else {
    category = state.categories.find((item) => item.id === input.categoryId);
    if (!category) return fail("Chọn danh mục.");
    const expected: Flow = input.kind === "income" ? "income" : "expense";
    if (category.flow !== expected) return fail("Danh mục không khớp loại giao dịch.");
  }

  const parent = category?.parentId
    ? state.categories.find((item) => item.id === category?.parentId)
    : undefined;
  const next: Omit<Entry, "id" | "createdAt"> = {
    kind: input.kind,
    amount: input.amount,
    accountId: account.id,
    accountName: account.name,
    counterAccountId: counter?.id ?? null,
    counterAccountName: counter?.name ?? null,
    categoryId: category?.id ?? null,
    categoryName: category ? (parent ? `${parent.name} · ${category.name}` : category.name) : null,
    categoryColor: category?.color ?? null,
    note: input.note.trim().slice(0, 280),
    date: input.date,
    balanceBefore: null,
    balanceAfter: null,
  };

  if (input.id) {
    const existing = state.entries.find((entry) => entry.id === input.id);
    if (!existing || existing.kind === "adjustment") return fail("Không sửa được giao dịch này.");
    const entries = state.entries.map((entry) => (entry.id === existing.id ? { ...entry, ...next } : entry));
    return ok(withBalances({ ...state, entries }));
  }

  return ok(withBalances({ ...state, entries: [...state.entries, { ...next, id: createId(), createdAt: timestamp }] }));
}

export function removeEntry(state: State, id: string): Result {
  if (!state.entries.some((entry) => entry.id === id)) return fail("Không tìm thấy giao dịch.");
  return ok(withBalances({ ...state, entries: state.entries.filter((entry) => entry.id !== id) }));
}

function validateParent(state: State, id: string | null, parentId: string | null, flow: Flow): string | null {
  if (!parentId) return null;
  if (parentId === id) return "Danh mục không thể là cha của chính nó.";
  const parent = state.categories.find((category) => category.id === parentId);
  if (!parent || parent.flow !== flow || parent.parentId) return "Chỉ gắn được vào danh mục gốc cùng loại.";
  if (id && state.categories.some((category) => category.parentId === id)) {
    return "Danh mục đang có danh mục con, không thể chuyển thành danh mục con.";
  }
  return null;
}

function isColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeColor(value: string): string {
  return isColor(value) ? value.toLowerCase() : "#1d4ed8";
}
