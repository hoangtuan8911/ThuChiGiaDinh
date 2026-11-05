import { freshData } from "./defaults";
import type { Account, AccountKind, AppData, Books, Category, LedgerScope, Transaction, TxType } from "./types";

const KINDS = new Set<AccountKind>(["bank", "ew", "cash", "cr"]);
const TYPES = new Set<TxType>(["t", "x", "p"]);

/** Đọc sổ mới hoặc bản HTML cũ (`tx`, `accs`, `cats`, `bud`). Trả null nếu không phải sổ. */
export function normalize(input: unknown): AppData | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  if (Array.isArray(record.accounts) && record.categories && typeof record.categories === "object") {
    return fromCurrent(record);
  }
  if (Array.isArray(record.tx) || Array.isArray(record.accs) || record.cats) return fromLegacy(record);
  return null;
}

function fromCurrent(record: Record<string, unknown>): AppData {
  const data = freshData();
  const categories = record.categories;
  if (isScopedBooks(categories)) {
    data.categories.family = readBooks(categories.family, data.categories.family);
    data.categories.personal = readBooks(categories.personal, data.categories.personal);
  } else if (isRecord(categories)) {
    if (Array.isArray(categories.income)) data.categories.family.income = asCategories(categories.income);
    if (Array.isArray(categories.expense)) data.categories.family.expense = asCategories(categories.expense);
  }
  data.budgets = readBudgets(record.budgets);
  if (Array.isArray(record.accounts)) data.accounts = asAccounts(record.accounts);
  data.transactions = asTransactions(record.transactions);
  if (typeof record.lastBackup === "string") data.lastBackup = record.lastBackup;
  return data;
}

function fromLegacy(record: Record<string, unknown>): AppData {
  const data = freshData();
  const cats = (record.cats ?? {}) as { thu?: unknown; chi?: unknown };
  const income = asCategories(cats.thu);
  const expense = asCategories(cats.chi);
  if (income.length) data.categories.family.income = income;
  if (expense.length) data.categories.family.expense = expense;
  data.budgets = readBudgets(record.bud);
  if (Array.isArray(record.accs)) data.accounts = asAccounts(record.accs);
  else data.accounts = accountsFromLegacyBalance(record.acc);
  data.transactions = asTransactions(record.tx).map((tx) => repairLegacyTx(tx, record.tx));
  if (!data.accounts.length) data.accounts = freshData().accounts;
  return data;
}

function repairLegacyTx(tx: Transaction, rawList: unknown): Transaction {
  if (tx.accountId) return tx;
  const raw = Array.isArray(rawList) ? rawList.find((item) => isRecord(item) && item.id === tx.id) : undefined;
  const src = isRecord(raw) ? raw.src : undefined;
  const accountId = src === "c" ? "a2" : "a1";
  return { ...tx, accountId, toAccountId: tx.type === "p" ? tx.toAccountId || "a2" : tx.toAccountId };
}

function accountsFromLegacyBalance(value: unknown): Account[] {
  const acc = isRecord(value) ? value : {};
  const open = numberOr(acc.open, 0);
  const debt = numberOr(acc.debt, 0);
  const limit = numberOr(acc.limit, 0);
  return [
    { id: "a1", name: "Tài khoản chính", kind: "bank", opening: open },
    { id: "a2", name: "Thẻ tín dụng", kind: "cr", opening: debt, limit },
  ];
}

function asCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return [];
  return value.map(asCategory).filter((category): category is Category => category !== null);
}

function asCategory(value: unknown): Category | null {
  if (typeof value === "string" && value.trim()) return { name: value.trim(), subs: [] };
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name : typeof value.n === "string" ? value.n : "";
  if (!name.trim()) return null;
  const rawSubs = Array.isArray(value.subs) ? value.subs : Array.isArray(value.s) ? value.s : [];
  const subs = rawSubs.filter((sub): sub is string => typeof sub === "string" && sub.trim() !== "");
  const color = typeof value.color === "string" ? value.color : typeof value.c === "string" ? value.c : undefined;
  return { name: name.trim(), subs, color };
}

function isScopedBooks(value: unknown): value is { family: unknown; personal: unknown } {
  return isRecord(value) && isRecord(value.family) && isRecord(value.personal) && (Array.isArray(value.family.income) || Array.isArray(value.family.expense));
}

function readBooks(value: unknown, fallback: Books): Books {
  if (!isRecord(value)) return fallback;
  return {
    income: Array.isArray(value.income) ? asCategories(value.income) : fallback.income,
    expense: Array.isArray(value.expense) ? asCategories(value.expense) : fallback.expense,
  };
}

function readBudgets(value: unknown): Record<LedgerScope, Record<string, number>> {
  if (isRecord(value) && (isRecord(value.family) || isRecord(value.personal)) && typeof value.family !== "number" && typeof value.personal !== "number") {
    return {
      family: asBudgets(value.family),
      personal: asBudgets(value.personal),
    };
  }
  return { family: asBudgets(value), personal: {} };
}

function asBudgets(value: unknown): Record<string, number> {
  if (Array.isArray(value)) {
    const entries = value.filter((pair): pair is [unknown, unknown] => Array.isArray(pair) && pair.length >= 2);
    return Object.fromEntries(
      entries
        .map(([name, amount]) => [String(name), numberOr(amount, 0)] as const)
        .filter(([, amount]) => amount > 0),
    );
  }
  if (!isRecord(value)) return {};
  const budgets: Record<string, number> = {};
  for (const [name, amount] of Object.entries(value)) {
    const parsed = numberOr(amount, 0);
    if (parsed > 0) budgets[name] = parsed;
  }
  return budgets;
}

function asAccounts(value: unknown): Account[] {
  if (!Array.isArray(value)) return [];
  return value.map(asAccount).filter((account): account is Account => account !== null);
}

function asAccount(value: unknown): Account | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const name = typeof value.name === "string" ? value.name : typeof value.n === "string" ? value.n : "";
  const kind = (typeof value.kind === "string" ? value.kind : value.k) as AccountKind;
  if (!name || !KINDS.has(kind)) return null;
  const opening = numberOr(value.opening ?? value.o, 0);
  const limitValue = value.limit ?? value.l;
  const limit = limitValue === undefined ? undefined : numberOr(limitValue, 0);
  return { id: value.id, name, kind, opening, limit: kind === "cr" ? (limit ?? 0) : undefined };
}

function asTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) return [];
  return value.map(asTransaction).filter((tx): tx is Transaction => tx !== null);
}

function asTransaction(value: unknown): Transaction | null {
  if (!isRecord(value)) return null;
  const type = (value.type ?? value.t) as TxType;
  const date = typeof value.date === "string" ? value.date : typeof value.d === "string" ? value.d : "";
  const amount = numberOr(value.amount ?? value.a, NaN);
  const id = numberOr(value.id, NaN);
  if (!TYPES.has(type) || !date || !Number.isFinite(amount) || !Number.isFinite(id)) return null;
  const category = typeof value.category === "string" ? value.category : typeof value.c === "string" ? value.c : "";
  const sub = typeof value.sub === "string" ? value.sub : typeof value.sc === "string" ? value.sc : "";
  const accountId = typeof value.accountId === "string" ? value.accountId : typeof value.ac === "string" ? value.ac : "";
  const toAccountId = typeof value.toAccountId === "string" ? value.toAccountId : typeof value.to === "string" ? value.to : "";
  const note = typeof value.note === "string" ? value.note : typeof value.n === "string" ? value.n : "";
  const orderValue = value.order ?? value.ts;
  const order = orderValue === undefined ? undefined : numberOr(orderValue, NaN);
  const scope: LedgerScope = value.scope === "personal" ? "personal" : "family";
  const tx: Transaction = { id, type, date, amount, category, sub, accountId, toAccountId, note, scope };
  if (order !== undefined && Number.isFinite(order)) tx.order = order;
  return tx;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
