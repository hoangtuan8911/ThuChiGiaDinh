import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { freshData } from "./defaults";
import { saveTransaction } from "./mutate";
import { buildMonthReport, buildPdf } from "./pdf";
import type { AppData } from "./types";

function add(data: AppData, type: "t" | "x" | "p", amount: string, date: string, category = "Ăn uống", note = ""): AppData {
  const saved = saveTransaction(data, {
    type,
    amountText: amount,
    date,
    category,
    sub: type === "x" ? "Cà phê" : "",
    accountId: "a1",
    toAccountId: type === "p" ? "a2" : "",
    note,
  });
  if (!saved.ok) throw new Error(saved.error);
  return saved.data;
}

describe("pdf", () => {
  it("gom thu chi theo ngày và không tính chuyển khoản vào tổng", async () => {
    let data = freshData();
    data = add(data, "t", "30000000", "2026-11-01", "Lương");
    data = add(data, "x", "50k", "2026-11-04", "Ăn uống", "sáng");
    data = add(data, "p", "3000000", "2026-11-04", "Chuyển khoản");
    data = add(data, "x", "1.5tr", "2026-11-15", "Nhà cửa");
    data = add(data, "t", "10tr", "2026-10-02", "Lương");
    data = add(data, "x", "2tr", "2026-10-08", "Ăn uống");

    const report = buildMonthReport(data, "2026-11");
    expect(report.heading).toBe("Thu Chi Gia Đình");
    expect(report.monthText).toBe("Tháng 11/2026");
    expect(report.income).toBe(30_000_000);
    expect(report.expense).toBe(1_550_000);
    expect(report.days.map((day) => day.date)).toEqual(["2026-11-01", "2026-11-04", "2026-11-15"]);

    const fourth = report.days[1];
    expect(fourth?.label).toBe("Thứ tư, 04/11/2026");
    expect(fourth?.incomeRows).toEqual([]);
    expect(fourth?.expenseRows[0]).toMatchObject({ title: "Ăn uống › Cà phê", amount: 50_000 });
    expect(fourth?.expenseRows[0]?.meta).toContain("sáng");
    expect(fourth?.transfers[0]?.title).toBe("Tài khoản chính sang Thẻ tín dụng");
    expect(fourth?.transfers[0]?.amount).toBe(3_000_000);
    expect(report.days[0]?.incomeRows[0]?.amount).toBe(30_000_000);
    expect(report.categories.find((row) => row.name === "Ăn uống")?.total).toBe(50_000);
    expect(report.trend.map((point) => point.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(report.trend.at(-1)).toMatchObject({ income: 30_000_000, expense: 1_550_000, current: true, label: "11/26" });
    expect(report.trend.at(-2)).toMatchObject({ income: 10_000_000, expense: 2_000_000, current: false });
    expect(report.accounts.length).toBeGreaterThan(0);

    const font = readFileSync(new URL("./fonts/Roboto-Regular.ttf", import.meta.url)).toString("base64");
    for (const includeBalances of [false, true]) {
      const text = await (await buildPdf(data, "2026-11", font, { includeBalances })).text();
      expect(text.startsWith("%PDF")).toBe(true);
      expect(text).toContain("Roboto");
      expect(text).not.toContain("/DCTDecode");
    }
  });
});
