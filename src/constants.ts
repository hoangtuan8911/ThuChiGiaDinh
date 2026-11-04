import type { AccountKind } from "./types";

export const KIND_LABEL: Record<AccountKind, string> = {
  bank: "Ngân hàng",
  credit: "Thẻ tín dụng",
  ewallet: "Ví điện tử",
};

export const BANK_NAMES = [
  "Vietcombank",
  "Techcombank",
  "BIDV",
  "VietinBank",
  "Agribank",
  "MB Bank",
  "ACB",
  "VPBank",
  "TPBank",
  "Sacombank",
  "HDBank",
  "VIB",
  "SHB",
  "OCB",
];

export const WALLET_NAMES = ["MoMo", "ZaloPay", "VNPay", "ShopeePay", "Viettel Money"];

export const PALETTE = [
  "#b42318",
  "#c2410c",
  "#b45309",
  "#3f6212",
  "#047857",
  "#0f766e",
  "#0e7490",
  "#0369a1",
  "#1d4ed8",
  "#4338ca",
  "#6d28d9",
  "#a21caf",
  "#be185d",
  "#57534e",
];
