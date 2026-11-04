import { PALETTE } from "./defaults";
import { formatVnd } from "./money";
import type { Account, AppData, Category, Tone, Transaction } from "./types";

export interface AccountSnapshot {
  account: Account;
  /** Số dư tiền, hoặc hạn mức khả dụng nếu là thẻ. */
  available: number;
  /** Chỉ có với thẻ: dư nợ. */
  debt: number | null;
  tone: Tone;
  /** Dòng số chính. Thẻ chưa có hạn mức thì là câu chữ, không phải số. */
  primary: string;
  showWarning: boolean;
}

export interface MonthTotals {
  income: number;
  expense: number;
  left: number;
  tone: Tone;
  ratioText: string;
  ratioNote: string;
}

export interface CategorySpend {
  name: string;
  total: number;
  budget: number;
  tone: Tone;
  /** Phần trăm ngân sách nếu có, ngược lại phần trăm trên tổng chi. */
  percent: number;
  caption: string;
  tag: "" | "Sát mức" | "VƯỢT";
  subs: { name: string; total: number }[];
}

export function orderOf(tx: Transaction): number {
  return tx.order ?? tx.id;
}

export function netFlow(transactions: Transaction[], accountId: string): number {
  let net = 0;
  for (const tx of transactions) {
    if (tx.type === "t") {
      if (tx.accountId === accountId) net += tx.amount;
    } else if (tx.type === "x") {
      if (tx.accountId === accountId) net -= tx.amount;
    } else {
      if (tx.toAccountId === accountId) net += tx.amount;
      if (tx.accountId === accountId) net -= tx.amount;
    }
  }
  return net;
}

export function accountSnapshots(data: AppData): AccountSnapshot[] {
  return data.accounts.map((account) => {
    const net = netFlow(data.transactions, account.id);
    if (account.kind === "cr") {
      const debt = account.opening - net;
      const limit = account.limit ?? 0;
      const available = limit - debt;
      if (!(limit > 0)) {
        return { account, available, debt, tone: "none", primary: "Chưa đặt hạn mức", showWarning: false };
      }
      const tone: Tone = available < 0 ? "bad" : available < limit * 0.2 ? "warn" : "ok";
      return { account, available, debt, tone, primary: "", showWarning: available < 0 };
    }
    const balance = account.opening + net;
    return {
      account,
      available: balance,
      debt: null,
      tone: balance < 0 ? "bad" : "ok",
      primary: "",
      showWarning: balance < 0,
    };
  });
}

export function monthTotals(transactions: Transaction[], month: string): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (!tx.date.startsWith(month)) continue;
    if (tx.type === "t") income += tx.amount;
    if (tx.type === "x") expense += tx.amount;
  }
  const left = income - expense;
  if (income <= 0 && expense > 0) {
    return { income, expense, left, tone: "bad", ratioText: "∞", ratioNote: " ⚠ Chi vượt thu" };
  }
  if (income <= 0) {
    return { income, expense, left, tone: "ok", ratioText: "0%", ratioNote: "" };
  }
  const ratio = (expense / income) * 100;
  if (ratio > 100) {
    return { income, expense, left, tone: "bad", ratioText: `${ratio.toFixed(0)}%`, ratioNote: " ⚠ Chi vượt thu" };
  }
  if (ratio >= 90) {
    return { income, expense, left, tone: "warn", ratioText: `${ratio.toFixed(0)}%`, ratioNote: " ⚠ Sát ngưỡng" };
  }
  return { income, expense, left, tone: "ok", ratioText: `${ratio.toFixed(0)}%`, ratioNote: "" };
}

export function categorySpend(data: AppData, month: string): CategorySpend[] {
  const totals = new Map<string, number>();
  const subs = new Map<string, Map<string, number>>();
  let monthExpense = 0;
  for (const tx of data.transactions) {
    if (tx.type !== "x" || !tx.date.startsWith(month)) continue;
    monthExpense += tx.amount;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount);
    if (tx.sub) {
      const group = subs.get(tx.category) ?? new Map<string, number>();
      group.set(tx.sub, (group.get(tx.sub) ?? 0) + tx.amount);
      subs.set(tx.category, group);
    }
  }
  for (const [name, budget] of Object.entries(data.budgets)) {
    if (budget > 0 && !totals.has(name)) totals.set(name, 0);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
    .map(([name, total]) => {
      const budget = data.budgets[name] ?? 0;
      const percent = budget > 0 ? (total / budget) * 100 : monthExpense > 0 ? (total / monthExpense) * 100 : 0;
      const over = budget > 0 && total > budget;
      const near = budget > 0 && !over && percent >= 80;
      const children = [...(subs.get(name)?.entries() ?? [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"));
      return {
        name,
        total,
        budget,
        tone: over ? "bad" : near ? "warn" : budget > 0 ? "ok" : "none",
        percent,
        caption:
          budget > 0
            ? `Ngân sách ${formatVnd(budget)} · ${percent.toFixed(0)}%`
            : monthExpense > 0
              ? `${percent.toFixed(0)}% tổng chi`
              : "",
        tag: over ? "VƯỢT" : near ? "Sát mức" : "",
        subs: children.map(([child, amount]) => ({ name: child, total: amount })),
      };
    });
}

export function screenOrder(transactions: Transaction[], month?: string): Transaction[] {
  return transactions
    .filter((tx) => (month ? tx.date.startsWith(month) : true))
    .sort((a, b) => b.date.localeCompare(a.date) || orderOf(b) - orderOf(a));
}

export function reportOrder(transactions: Transaction[], month: string): Transaction[] {
  return transactions
    .filter((tx) => tx.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || orderOf(a) - orderOf(b));
}

/** ▲ = -1 (lên trên), ▼ = +1. Đứng ở mép nhóm thì giữ nguyên. Không đổi ngày khác. */
export function moveWithinDay(transactions: Transaction[], id: number, direction: -1 | 1): Transaction[] {
  const current = transactions.find((tx) => tx.id === id);
  if (!current) return transactions;
  const group = transactions.filter((tx) => tx.date === current.date).sort((a, b) => orderOf(b) - orderOf(a));
  const index = group.findIndex((tx) => tx.id === id) + direction;
  if (index < 0 || index >= group.length) return transactions;
  const other = group[index];
  const currentOrder = orderOf(current);
  const otherOrder = orderOf(other);
  return transactions.map((tx) => {
    if (tx.id === current.id) return { ...tx, order: otherOrder };
    if (tx.id === other.id) return { ...tx, order: currentOrder };
    return tx;
  });
}

export function categoryColor(categories: Category[], name: string): string {
  const found = categories.find((category) => category.name === name);
  if (found?.color) return found.color;
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
}

export function allCategories(data: AppData): Category[] {
  return [...data.categories.expense, ...data.categories.income];
}

export function backupAgeDays(lastBackup: string | undefined, today: string): number | null {
  if (!lastBackup) return null;
  const start = Date.parse(`${lastBackup}T00:00:00`);
  const end = Date.parse(`${today}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}
