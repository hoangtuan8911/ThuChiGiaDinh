export type AccountKind = "bank" | "ew" | "cash" | "cr";
export type TxType = "t" | "x" | "p";
export type Flow = "income" | "expense";

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
}

export interface AppData {
  version: 2;
  categories: { income: Category[]; expense: Category[] };
  budgets: Record<string, number>;
  accounts: Account[];
  transactions: Transaction[];
  lastBackup?: string;
}

export type Tone = "ok" | "warn" | "bad" | "none";
