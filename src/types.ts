export type AccountKind = "bank" | "credit" | "ewallet";
export type Flow = "income" | "expense";
export type EntryKind = "income" | "expense" | "adjustment" | "transfer";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  institution: string;
  /** Ngân hàng và ví: tiền đang có. Thẻ: dư nợ (số dương là đang nợ). */
  balance: number;
  creditLimit: number | null;
  color: string;
  note: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  flow: Flow;
  color: string;
  parentId: string | null;
  createdAt: string;
}

export interface Entry {
  id: string;
  kind: EntryKind;
  amount: number;
  accountId: string;
  accountName: string;
  counterAccountId: string | null;
  counterAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  note: string;
  date: string;
  createdAt: string;
  balanceBefore: number | null;
  balanceAfter: number | null;
}

export interface State {
  version: 1;
  accounts: Account[];
  categories: Category[];
  entries: Entry[];
}

export interface NewAccountInput {
  name: string;
  kind: AccountKind;
  institution: string;
  color: string;
  note: string;
  openingBalance: number;
  creditLimit: number | null;
  date: string;
}

export interface AccountPatch {
  id: string;
  name: string;
  institution: string;
  color: string;
  note: string;
  creditLimit: number | null;
}

export interface AdjustInput {
  accountId: string;
  nextBalance: number;
  date: string;
  note: string;
  entryId?: string;
}

export interface CategoryInput {
  id?: string;
  name: string;
  flow: Flow;
  color: string;
  parentId: string | null;
}

export interface EntryInput {
  id?: string;
  kind: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  accountId: string;
  counterAccountId?: string | null;
  categoryId?: string | null;
  note: string;
}
