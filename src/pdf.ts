import { jsPDF } from "jspdf";
import { accountSnapshots, categorySpend, reportOrder } from "./calc";
import { formatDay, formatVnd, monthLabel } from "./money";
import type { AppData } from "./types";

export interface ReportLine {
  kind: "title" | "head" | "row";
  left: string;
  right?: string;
  color?: "green" | "red" | "blue" | "ink";
}

const COLORS = {
  green: [22, 163, 74] as const,
  red: [220, 38, 38] as const,
  blue: [37, 99, 235] as const,
  ink: [17, 17, 17] as const,
};

export function reportLines(data: AppData, month: string): ReportLine[] {
  const totals = monthTransactions(data, month);
  const income = totals.filter((tx) => tx.type === "t").reduce((sum, tx) => sum + tx.amount, 0);
  const expense = totals.filter((tx) => tx.type === "x").reduce((sum, tx) => sum + tx.amount, 0);
  const lines: ReportLine[] = [
    { kind: "title", left: `Thu Chi Gia Đình — ${monthLabel(month)}` },
    { kind: "row", left: "Tổng thu", right: formatVnd(income), color: "green" },
    { kind: "row", left: "Tổng chi", right: formatVnd(expense), color: "red" },
    { kind: "row", left: "Còn lại", right: formatVnd(income - expense), color: income < expense ? "red" : "ink" },
    { kind: "head", left: "Tài khoản (đến hiện tại)" },
  ];
  for (const snapshot of accountSnapshots(data)) {
    const card = snapshot.account.kind === "cr";
    lines.push({
      kind: "row",
      left: card ? `${snapshot.account.name} (khả dụng)` : snapshot.account.name,
      right: snapshot.primary || formatVnd(snapshot.available),
      color: snapshot.tone === "bad" ? "red" : "ink",
    });
  }
  lines.push({ kind: "head", left: "Chi theo danh mục" });
  for (const row of categorySpend(data, month)) {
    lines.push({
      kind: "row",
      left: row.name,
      right: formatVnd(row.total),
      color: row.tone === "bad" ? "red" : "ink",
    });
  }
  lines.push({ kind: "head", left: "Giao dịch" });
  for (const tx of reportOrder(data.transactions, month)) {
    const route =
      tx.type === "p"
        ? `${accountName(data, tx.accountId)} → ${accountName(data, tx.toAccountId)}`
        : accountName(data, tx.accountId);
    const label = `${formatDay(tx.date)}  ${tx.category}${tx.sub ? ` › ${tx.sub}` : ""} [${route}]`;
    const sign = tx.type === "t" ? "+" : tx.type === "x" ? "−" : "";
    lines.push({
      kind: "row",
      left: label,
      right: `${sign}${formatVnd(tx.amount)}`,
      color: tx.type === "t" ? "green" : tx.type === "x" ? "red" : "blue",
    });
  }
  return lines;
}

export async function buildPdf(data: AppData, month: string, fontBase64: string): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.setFont("Roboto");
  const margin = 16;
  const width = 210 - margin * 2;
  const bottom = 287;
  let y = 20;
  const paint = (line: ReportLine, continued: boolean) => {
    const size = line.kind === "title" ? 16 : line.kind === "head" ? 13 : 11;
    const gap = line.kind === "head" ? 8 : 2;
    doc.setFontSize(size);
    const leftWidth = line.right ? width - 42 : width;
    const wrapped = doc.splitTextToSize(line.left, leftWidth) as string[];
    const height = gap + wrapped.length * (size * 0.45);
    if (y + height > bottom) {
      doc.addPage();
      doc.setFont("Roboto");
      y = 16;
      if (!continued) {
        doc.setFontSize(11);
        doc.setTextColor(...COLORS.ink);
        doc.text(`${monthLabel(month)} (tiếp)`, margin, y);
        y += 8;
      }
    }
    y += gap;
    const color = COLORS[line.color ?? "ink"];
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(wrapped, margin, y);
    if (line.right) doc.text(line.right, margin + width, y, { align: "right" });
    y += wrapped.length * (size * 0.45);
  };
  const lines = reportLines(data, month);
  lines.forEach((line, index) => paint(line, index === 0));
  return doc.output("blob");
}

function monthTransactions(data: AppData, month: string) {
  return data.transactions.filter((tx) => tx.date.startsWith(month));
}

function accountName(data: AppData, id: string | undefined): string {
  return data.accounts.find((account) => account.id === id)?.name ?? "?";
}
