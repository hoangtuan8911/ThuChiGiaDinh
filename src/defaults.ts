import type { AppData, Category } from "./types";

function category(name: string, subs: string[] = []): Category {
  return { name, subs };
}

export const DEFAULT_INCOME: Category[] = [
  category("Lương"),
  category("Thưởng"),
  category("Kinh doanh"),
  category("Thu khác"),
];

export const DEFAULT_EXPENSE: Category[] = [
  category("Ăn uống", ["Ăn ngoài", "Cà phê"]),
  category("Chợ/Siêu thị"),
  category("Nhà cửa", ["Điện", "Nước", "Internet", "Điện thoại", "Thuê nhà"]),
  category("Xăng xe"),
  category("Học phí/Con cái"),
  category("Sức khỏe", ["Khám bệnh", "Thuốc", "Bảo hiểm y tế"]),
  category("Mua sắm"),
  category("Giải trí"),
  category("Hiếu hỉ"),
  category("Trả nợ"),
  category("Chi khác"),
];

export const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
];

export function freshData(): AppData {
  return {
    version: 2,
    categories: {
      income: DEFAULT_INCOME.map((item) => ({ ...item, subs: [...item.subs] })),
      expense: DEFAULT_EXPENSE.map((item) => ({ ...item, subs: [...item.subs] })),
    },
    budgets: {},
    accounts: [
      { id: "a1", name: "Tài khoản chính", kind: "bank", opening: 0 },
      { id: "a2", name: "Thẻ tín dụng", kind: "cr", opening: 0, limit: 0 },
    ],
    transactions: [],
  };
}
