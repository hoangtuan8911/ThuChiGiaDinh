import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { freshData } from "./defaults";
import { saveTransaction } from "./mutate";
import { buildPdf, reportLines } from "./pdf";

describe("pdf", () => {
  it("báo cáo có chữ tiếng Việt và không nhúng ảnh JPEG", async () => {
    const saved = saveTransaction(freshData(), {
      type: "x",
      amountText: "50k",
      date: "2026-11-04",
      category: "Ăn uống",
      sub: "Cà phê",
      accountId: "a1",
      toAccountId: "",
      note: "sáng",
    });
    if (!saved.ok) throw new Error(saved.error);
    const lines = reportLines(saved.data, "2026-11");
    expect(lines[0]?.left).toBe("Thu Chi Gia Đình — Tháng 11/2026");
    expect(lines.find((line) => line.left === "Tổng chi")?.right).toBe("50.000đ");
    const tx = lines.find((line) => line.left.includes("Cà phê"));
    expect(tx?.right).toBe("−50.000đ");
    expect(tx?.color).toBe("red");
    const font = readFileSync(new URL("./fonts/Roboto-Regular.ttf", import.meta.url)).toString("base64");
    const text = await (await buildPdf(saved.data, "2026-11", font)).text();
    expect(text.startsWith("%PDF")).toBe(true);
    expect(text).toContain("Roboto");
    expect(text).not.toContain("/DCTDecode");
  });
});
