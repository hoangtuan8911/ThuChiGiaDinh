export type AccountKind = "bank" | "ew" | "cash" | "cr";
export type TxType = "t" | "x" | "p";
export type Flow = "income" | "expense";
export type LedgerScope = "family" | "personal";
/** Dùng cho Báo cáo và Xuất PDF: thêm "all" để xem tổng cả hai sổ cộng lại. */
export type ReportScope = LedgerScope | "all";

export const SCOPE_LABEL: Record<LedgerScope, string> = {
  family: "Gia đình",
  personal: "Cá nhân",
};

export const REPORT_SCOPE_LABEL: Record<ReportScope, string> = {
  ...SCOPE_LABEL,
  all: "Tổng",
};

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** bank/ew/cash: số dư ban đầu. cr: dư nợ ban đầu. */
  opening: number;
  /** Chỉ thẻ tín dụng. 0 hoặc thiếu = chưa đặt hạn mức. */
  limit?: number;
}

export interface Category {
  name: string;
  subs: string[];
  color?: string;
}

export interface Transaction {
  id: number;
  type: TxType;
  date: string;
  amount: number;
  category: string;
  sub?: string;
  accountId: string;
  toAccountId?: string;
  note?: string;
  /** Thứ tự trong cùng ngày. Thiếu thì lấy id. Số lớn hơn hiện phía trên. */
  order?: number;
  scope: LedgerScope;
}

export interface Books {
  income: Category[];
  expense: Category[];
}

export interface AppData {
  version: 3;
  categories: Record<LedgerScope, Books>;
  budgets: Record<LedgerScope, Record<string, number>>;
  accounts: Account[];
  transactions: Transaction[];
  lastBackup?: string;
}

export type Tone = "ok" | "warn" | "bad" | "none";
