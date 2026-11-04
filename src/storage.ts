import { freshState, withBalances } from "./ledger";
import type { Account, AccountKind, Category, Entry, EntryKind, Flow, State } from "./types";

export const STORAGE_KEY = "so-nha.v1";

export function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    return parseBackup(raw) ?? freshState();
  } catch {
    return freshState();
  }
}

export function saveState(state: State): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function parseBackup(raw: string): State | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as Partial<State>;
  if (!Array.isArray(record.accounts) || !Array.isArray(record.categories) || !Array.isArray(record.entries)) {
    return null;
  }
  const accounts = record.accounts.map(asAccount).filter((account): account is Account => account !== null);
  const categories = record.categories.map(asCategory).filter((category): category is Category => category !== null);
  const entries = record.entries.map(asEntry).filter((entry): entry is Entry => entry !== null);
  return withBalances({ version: 1, accounts, categories, entries });
}

function asAccount(value: unknown): Account | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (!isAccountKind(value.kind)) return null;
  return {
    id: value.id,
    name: value.name,
    kind: value.kind,
    institution: typeof value.institution === "string" ? value.institution : "",
    balance: typeof value.balance === "number" ? value.balance : 0,
    creditLimit: typeof value.creditLimit === "number" ? value.creditLimit : null,
    color: typeof value.color === "string" ? value.color : "#1d4ed8",
    note: typeof value.note === "string" ? value.note : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
  };
}

function asCategory(value: unknown): Category | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (value.flow !== "income" && value.flow !== "expense") return null;
  return {
    id: value.id,
    name: value.name,
    flow: value.flow as Flow,
    color: typeof value.color === "string" ? value.color : "#57534e",
    parentId: typeof value.parentId === "string" ? value.parentId : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
  };
}

function asEntry(value: unknown): Entry | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.accountId !== "string" || typeof value.date !== "string") return null;
  if (!isEntryKind(value.kind) || typeof value.amount !== "number" || !Number.isFinite(value.amount)) return null;
  return {
    id: value.id,
    kind: value.kind,
    amount: value.amount,
    accountId: value.accountId,
    accountName: typeof value.accountName === "string" ? value.accountName : "",
    counterAccountId: typeof value.counterAccountId === "string" ? value.counterAccountId : null,
    counterAccountName: typeof value.counterAccountName === "string" ? value.counterAccountName : null,
    categoryId: typeof value.categoryId === "string" ? value.categoryId : null,
    categoryName: typeof value.categoryName === "string" ? value.categoryName : null,
    categoryColor: typeof value.categoryColor === "string" ? value.categoryColor : null,
    note: typeof value.note === "string" ? value.note : "",
    date: value.date,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    balanceBefore: typeof value.balanceBefore === "number" ? value.balanceBefore : null,
    balanceAfter: typeof value.balanceAfter === "number" ? value.balanceAfter : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isAccountKind(value: unknown): value is AccountKind {
  return value === "bank" || value === "credit" || value === "ewallet";
}

function isEntryKind(value: unknown): value is EntryKind {
  return value === "income" || value === "expense" || value === "adjustment" || value === "transfer";
}
