import type { AppData, Books, Category } from "./types";

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

export const PERSONAL_INCOME: Category[] = [
  category("Lương"),
  category("Thưởng"),
  category("Thu khác"),
];

export const PERSONAL_EXPENSE: Category[] = [
  category("Ăn uống", ["Ăn ngoài", "Cà phê"]),
  category("Đi lại", ["Xăng", "Gửi xe"]),
  category("Mua sắm"),
  category("Giải trí"),
  category("Sức khỏe", ["Khám bệnh", "Thuốc"]),
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

function cloneBooks(income: Category[], expense: Category[]): Books {
  return {
    income: income.map((item) => ({ ...item, subs: [...item.subs] })),
    expense: expense.map((item) => ({ ...item, subs: [...item.subs] })),
  };
}

export function freshData(): AppData {
  return {
    version: 3,
    categories: {
      family: cloneBooks(DEFAULT_INCOME, DEFAULT_EXPENSE),
      personal: cloneBooks(PERSONAL_INCOME, PERSONAL_EXPENSE),
    },
    budgets: { family: {}, personal: {} },
    accounts: [
      { id: "a1", name: "Tài khoản chính", kind: "bank", opening: 0 },
      { id: "a2", name: "Thẻ tín dụng", kind: "cr", opening: 0, limit: 0 },
    ],
    transactions: [],
  };
}
