import type { Account, AppData, Flow, LedgerScope, Transaction, TxType } from "./types";
import { isIsoDate, parseAmount } from "./money";

export type Result = { ok: true; data: AppData } | { ok: false; error: string };

function copy(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

function fail(error: string): Result {
  return { ok: false, error };
}

function flowOf(type: TxType): Flow | null {
  if (type === "t") return "income";
  if (type === "x") return "expense";
  return null;
}

export function listOf(data: AppData, scope: LedgerScope, flow: Flow) {
  const books = data.categories[scope];
  return flow === "income" ? books.income : books.expense;
}

export interface TxInput {
  id?: number;
  type: TxType;
  amountText: string;
  date: string;
  category: string;
  sub: string;
  accountId: string;
  toAccountId: string;
  note: string;
  scope?: LedgerScope;
}

export function saveTransaction(data: AppData, input: TxInput): Result {
  const amount = parseAmount(input.amountText);
  if (amount === null || amount <= 0) return fail("Số tiền không hợp lệ");
  if (!isIsoDate(input.date)) return fail("Chọn ngày");
  if (!data.accounts.length || !input.accountId) return fail("Chưa có tài khoản — bấm 🏦 Tài khoản để thêm");
  if (!data.accounts.some((account) => account.id === input.accountId)) return fail("Chọn tài khoản");
  if (input.type === "p") {
    if (!input.toAccountId) return fail("Chọn tài khoản nhận");
    if (input.accountId === input.toAccountId) return fail("Chọn 2 tài khoản khác nhau");
  } else if (!input.category || input.category === "__new__") {
    return fail("Chọn danh mục");
  }

  const next = copy(data);
  const existing = input.id ? next.transactions.find((tx) => tx.id === input.id) : undefined;
  const id = existing?.id ?? nextId(next);
  const tx: Transaction = {
    id,
    type: input.type,
    date: input.date,
    amount,
    category: input.type === "p" ? "Chuyển khoản" : input.category,
    sub: input.type === "p" || input.sub === "__new__" ? "" : input.sub,
    accountId: input.accountId,
    toAccountId: input.type === "p" ? input.toAccountId : "",
    note: input.note.trim(),
    order: existing?.order,
    scope: input.scope ?? existing?.scope ?? "family",
  };
  if (existing) Object.assign(existing, tx);
  else next.transactions.push(tx);
  return { ok: true, data: next };
}

export function deleteTransaction(data: AppData, id: number): AppData {
  const next = copy(data);
  next.transactions = next.transactions.filter((tx) => tx.id !== id);
  return next;
}

/** Đưa một giao dịch sang sổ kia. Danh mục cha và con được thêm vào sổ đích nếu chưa có. */
export function moveTransaction(data: AppData, id: number, scope: LedgerScope): AppData {
  const next = copy(data);
  const tx = next.transactions.find((item) => item.id === id);
  if (!tx || tx.scope === scope) return next;
  const from = tx.scope;
  tx.scope = scope;
  const flow = flowOf(tx.type);
  if (!flow || !tx.category || tx.category === "Chuyển khoản") return next;
  const list = listOf(next, scope, flow);
  let parent = list.find((category) => category.name === tx.category);
  if (!parent) {
    const source = listOf(next, from, flow).find((category) => category.name === tx.category);
    parent = { name: tx.category, subs: [], color: source?.color };
    list.push(parent);
  }
  if (tx.sub && !parent.subs.includes(tx.sub)) parent.subs.push(tx.sub);
  return next;
}

export function addCategory(data: AppData, flow: Flow, name: string, scope: LedgerScope = "family"): Result {
  const trimmed = name.trim();
  if (!trimmed) return fail("Nhập tên");
  const next = copy(data);
  const list = listOf(next, scope, flow);
  if (list.some((category) => category.name === trimmed)) return fail("Đã có danh mục này");
  list.push({ name: trimmed, subs: [] });
  return { ok: true, data: next };
}

export function renameCategory(data: AppData, flow: Flow, oldName: string, newName: string, scope: LedgerScope = "family"): Result {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return { ok: true, data };
  const next = copy(data);
  const list = listOf(next, scope, flow);
  if (list.some((category) => category.name === trimmed)) return fail("Đã có danh mục này");
  const category = list.find((item) => item.name === oldName);
  if (!category) return fail("Không tìm thấy danh mục");
  const type = flow === "income" ? "t" : "x";
  for (const tx of next.transactions) {
    if (tx.scope === scope && tx.type === type && tx.category === oldName) tx.category = trimmed;
  }
  if (flow === "expense" && next.budgets[scope][oldName]) {
    next.budgets[scope][trimmed] = next.budgets[scope][oldName];
    delete next.budgets[scope][oldName];
  }
  category.name = trimmed;
  return { ok: true, data: next };
}

export function deleteCategory(data: AppData, flow: Flow, name: string, scope: LedgerScope = "family"): AppData {
  const next = copy(data);
  const list = listOf(next, scope, flow);
  const index = list.findIndex((category) => category.name === name);
  if (index >= 0) list.splice(index, 1);
  if (flow === "expense") delete next.budgets[scope][name];
  return next;
}

export function setCategoryColor(data: AppData, flow: Flow, name: string, color: string, scope: LedgerScope = "family"): AppData {
  const next = copy(data);
  const category = listOf(next, scope, flow).find((item) => item.name === name);
  if (category) category.color = color;
  return next;
}

export function addSub(data: AppData, flow: Flow, parent: string, name: string, scope: LedgerScope = "family"): Result {
  const trimmed = name.trim();
  if (!trimmed) return fail("Nhập tên");
  const next = copy(data);
  const category = listOf(next, scope, flow).find((item) => item.name === parent);
  if (!category) return fail("Không tìm thấy danh mục");
  if (category.subs.includes(trimmed)) return fail("Đã có");
  category.subs.push(trimmed);
  return { ok: true, data: next };
}

export function renameSub(data: AppData, flow: Flow, parent: string, oldName: string, newName: string, scope: LedgerScope = "family"): Result {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return { ok: true, data };
  const next = copy(data);
  const category = listOf(next, scope, flow).find((item) => item.name === parent);
  if (!category) return fail("Không tìm thấy danh mục");
  if (category.subs.includes(trimmed)) return fail("Đã có");
  const index = category.subs.indexOf(oldName);
  if (index < 0) return fail("Không tìm thấy danh mục con");
  const type = flow === "income" ? "t" : "x";
  for (const tx of next.transactions) {
    if (tx.scope === scope && tx.type === type && tx.category === parent && tx.sub === oldName) tx.sub = trimmed;
  }
  category.subs[index] = trimmed;
  return { ok: true, data: next };
}

export function deleteSub(data: AppData, flow: Flow, parent: string, name: string, scope: LedgerScope = "family"): AppData {
  const next = copy(data);
  const category = listOf(next, scope, flow).find((item) => item.name === parent);
  if (category) category.subs = category.subs.filter((sub) => sub !== name);
  return next;
}

export interface AccountInput {
  id?: string;
  name: string;
  kind: Account["kind"];
  openingText: string;
  limitText: string;
}

export function saveAccount(data: AppData, input: AccountInput): Result {
  const name = input.name.trim();
  if (!name) return fail("Nhập tên");
  const opening = input.openingText.trim() ? parseAmount(input.openingText) : 0;
  if (opening === null) return fail("Số dư không hợp lệ");
  let limit = 0;
  if (input.kind === "cr") {
    const parsed = input.limitText.trim() ? parseAmount(input.limitText) : 0;
    if (parsed === null || parsed < 0) return fail("Hạn mức không hợp lệ");
    limit = parsed;
  }
  const next = copy(data);
  const existing = input.id ? next.accounts.find((account) => account.id === input.id) : undefined;
  const account: Account = {
    id: existing?.id ?? `a${nextId(next)}`,
    name,
    kind: input.kind,
    opening,
    limit: input.kind === "cr" ? limit : undefined,
  };
  if (existing) Object.assign(existing, account);
  else next.accounts.push(account);
  return { ok: true, data: next };
}

export function deleteAccount(data: AppData, id: string): Result {
  if (data.transactions.some((tx) => tx.accountId === id || tx.toAccountId === id)) {
    return fail("Tài khoản đã có giao dịch, không xóa được");
  }
  const next = copy(data);
  next.accounts = next.accounts.filter((account) => account.id !== id);
  return { ok: true, data: next };
}

export function saveBudgets(data: AppData, texts: Record<string, string>, scope: LedgerScope = "family"): Result {
  const next = copy(data);
  for (const [name, text] of Object.entries(texts)) {
    if (!text.trim()) {
      delete next.budgets[scope][name];
      continue;
    }
    const amount = parseAmount(text);
    if (amount === null) return fail(`Ngân sách "${name}" không hợp lệ`);
    if (amount > 0) next.budgets[scope][name] = amount;
    else delete next.budgets[scope][name];
  }
  return { ok: true, data: next };
}

function nextId(data: AppData): number {
  let max = 0;
  for (const tx of data.transactions) max = Math.max(max, tx.id);
  for (const account of data.accounts) {
    const match = /^a(\d+)$/.exec(account.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return Math.max(Date.now(), max + 1);
}

export function txFlow(type: TxType): Flow | null {
  return flowOf(type);
}
