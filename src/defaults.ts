import type { Category } from "./types";

const createdAt = "2026-01-01T00:00:00.000Z";

function category(
  id: string,
  name: string,
  flow: Category["flow"],
  color: string,
  parentId: string | null = null,
): Category {
  return { id, name, flow, color, parentId, createdAt };
}

export const DEFAULT_CATEGORIES: Category[] = [
  category("exp-food", "Ăn uống", "expense", "#c2410c"),
  category("exp-food-market", "Đi chợ", "expense", "#ea580c", "exp-food"),
  category("exp-food-out", "Ăn ngoài", "expense", "#c2410c", "exp-food"),
  category("exp-food-cafe", "Cafe", "expense", "#b45309", "exp-food"),
  category("exp-move", "Di chuyển", "expense", "#1d4ed8"),
  category("exp-move-fuel", "Xăng xe", "expense", "#1e40af", "exp-move"),
  category("exp-move-park", "Gửi xe", "expense", "#2563eb", "exp-move"),
  category("exp-move-ride", "Xe ôm / taxi", "expense", "#1d4ed8", "exp-move"),
  category("exp-home", "Nhà cửa", "expense", "#0f766e"),
  category("exp-home-rent", "Tiền nhà", "expense", "#0f766e", "exp-home"),
  category("exp-home-util", "Điện nước", "expense", "#0e7490", "exp-home"),
  category("exp-home-net", "Internet", "expense", "#115e59", "exp-home"),
  category("exp-shop", "Mua sắm", "expense", "#6d28d9"),
  category("exp-shop-clothes", "Quần áo", "expense", "#7c3aed", "exp-shop"),
  category("exp-shop-house", "Đồ gia dụng", "expense", "#5b21b6", "exp-shop"),
  category("exp-kids", "Con cái", "expense", "#be185d"),
  category("exp-kids-school", "Học phí", "expense", "#9d174d", "exp-kids"),
  category("exp-kids-baby", "Sữa và bỉm", "expense", "#be185d", "exp-kids"),
  category("exp-health", "Sức khỏe", "expense", "#b42318"),
  category("exp-health-clinic", "Khám bệnh", "expense", "#b42318", "exp-health"),
  category("exp-health-meds", "Thuốc", "expense", "#9f1239", "exp-health"),
  category("exp-fun", "Giải trí", "expense", "#0369a1"),
  category("exp-fun-travel", "Du lịch", "expense", "#0369a1", "exp-fun"),
  category("exp-fun-play", "Phim và game", "expense", "#0e7490", "exp-fun"),
  category("exp-other", "Khác", "expense", "#57534e"),
  category("inc-salary", "Lương", "income", "#047857"),
  category("inc-salary-main", "Lương chính", "income", "#047857", "inc-salary"),
  category("inc-salary-extra", "Lương phụ", "income", "#059669", "inc-salary"),
  category("inc-bonus", "Thưởng", "income", "#0f766e"),
  category("inc-biz", "Kinh doanh", "income", "#1d4ed8"),
  category("inc-invest", "Đầu tư", "income", "#6d28d9"),
  category("inc-invest-interest", "Lãi tiết kiệm", "income", "#6d28d9", "inc-invest"),
  category("inc-other", "Khác", "income", "#57534e"),
];
