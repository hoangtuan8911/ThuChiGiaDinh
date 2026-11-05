import { jsPDF } from "jspdf";
import { accountSnapshots, categorySpend, monthTotals, orderOf } from "./calc";
import { formatFullDay, formatVnd, monthLabel, shiftMonth, todayISO } from "./money";
import { REPORT_SCOPE_LABEL, type AppData, type ReportScope, type Transaction } from "./types";

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

const INK = [27, 36, 51] as const;
const MUTED = [107, 118, 134] as const;
const LINE = [225, 230, 238] as const;
const GREEN = [22, 122, 58] as const;
const RED = [185, 28, 28] as const;
const BLUE = [29, 78, 216] as const;
const NAVY = [22, 42, 74] as const;
const THU_BG = [232, 247, 238] as const;
const CHI_BG = [253, 236, 236] as const;
const MOVE_BG = [235, 242, 255] as const;

export interface ReportEntry {
  title: string;
  meta: string;
  amount: number;
}

export interface ReportDay {
  date: string;
  label: string;
  income: number;
  expense: number;
  incomeRows: ReportEntry[];
  expenseRows: ReportEntry[];
  transfers: ReportEntry[];
}

export interface TrendPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
  current: boolean;
}

export interface MonthReport {
  heading: string;
  scopeText: string;
  scopeLine: string;
  monthText: string;
  income: number;
  expense: number;
  left: number;
  ratioText: string;
  ratioBad: boolean;
  accounts: { name: string; value: string; detail: string }[];
  categories: { name: string; total: number; caption: string }[];
  trend: TrendPoint[];
  days: ReportDay[];
}

export interface PdfOptions {
  includeBalances: boolean;
  scope?: ReportScope;
}

const TREND_MONTHS = 6;

export function buildMonthReport(data: AppData, month: string, scope: ReportScope = "family"): MonthReport {
  const scoped = scope === "all" ? data.transactions : data.transactions.filter((tx) => tx.scope === scope);
  const totals = monthTotals(scoped, month);
  const days = new Map<string, Transaction[]>();
  for (const tx of scoped) {
    if (!tx.date.startsWith(month)) continue;
    const list = days.get(tx.date) ?? [];
    list.push(tx);
    days.set(tx.date, list);
  }
  return {
    heading: "Thu Chi Gia Đình",
    scopeText: REPORT_SCOPE_LABEL[scope],
    scopeLine: scope === "all" ? "Tổng cả hai sổ" : `Sổ ${REPORT_SCOPE_LABEL[scope].toLowerCase()}`,
    monthText: monthLabel(month),
    income: totals.income,
    expense: totals.expense,
    left: totals.left,
    ratioText: totals.ratioText,
    ratioBad: totals.tone === "bad" || totals.tone === "warn",
    accounts: accountSnapshots(data).map((snapshot) => {
      const card = snapshot.account.kind === "cr";
      const detail = card
        ? `Dư nợ ${formatVnd(snapshot.debt ?? 0)}${snapshot.account.limit ? ` / hạn mức ${formatVnd(snapshot.account.limit)}` : ""}`
        : kindLabel(snapshot.account.kind);
      return {
        name: card ? `${snapshot.account.name} · khả dụng` : snapshot.account.name,
        value: snapshot.primary || formatVnd(snapshot.available),
        detail,
      };
    }),
    categories: categorySpend(data, month, scope)
      .filter((row) => row.total > 0)
      .map((row) => ({ name: row.name, total: row.total, caption: row.tag ? `${row.caption} · ${row.tag}` : row.caption })),
    trend: Array.from({ length: TREND_MONTHS }, (_, index) => {
      const pointMonth = shiftMonth(month, index - (TREND_MONTHS - 1));
      const point = monthTotals(scoped, pointMonth);
      return {
        month: pointMonth,
        label: `${Number(pointMonth.slice(5, 7))}/${pointMonth.slice(2, 4)}`,
        income: point.income,
        expense: point.expense,
        current: pointMonth === month,
      };
    }),
    days: [...days.keys()].sort().map((date) => {
      const rows = (days.get(date) ?? []).sort((a, b) => orderOf(b) - orderOf(a));
      const incomeRows = rows.filter((tx) => tx.type === "t").map((tx) => entry(data, tx));
      const expenseRows = rows.filter((tx) => tx.type === "x").map((tx) => entry(data, tx));
      return {
        date,
        label: `${weekday(date)}, ${formatFullDay(date)}`,
        income: incomeRows.reduce((sum, row) => sum + row.amount, 0),
        expense: expenseRows.reduce((sum, row) => sum + row.amount, 0),
        incomeRows,
        expenseRows,
        transfers: rows.filter((tx) => tx.type === "p").map((tx) => entry(data, tx)),
      };
    }),
  };
}

export async function buildPdf(data: AppData, month: string, fontBase64: string, options: PdfOptions = { includeBalances: false }): Promise<Blob> {
  const report = buildMonthReport(data, month, options.scope ?? "family");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.setFont("Roboto");

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottom = 282;
  let y = 0;
  let page = 1;

  const useFont = (size: number) => {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(size);
  };

  const clip = (text: string, width: number): string => {
    const lines = doc.splitTextToSize(text || "", width) as string[];
    if (lines.length <= 1) return lines[0] ?? "";
    const cut = lines[0].replace(/\s+$/, "");
    return cut.length > 1 ? `${cut.slice(0, -1)}…` : cut;
  };

  const paintFooter = () => {
    useFont(8);
    doc.setTextColor(...MUTED);
    doc.text("Thu Chi Gia Đình", margin, 290);
    doc.text(`${report.scopeText}  ·  ${report.monthText}  ·  Trang ${page}`, pageWidth - margin, 290, { align: "right" });
  };

  const nextPage = () => {
    paintFooter();
    doc.addPage();
    doc.setFont("Roboto", "normal");
    page += 1;
    y = 16;
    useFont(9);
    doc.setTextColor(...NAVY);
    doc.text(`${report.heading}  ·  ${report.scopeText}  ·  ${report.monthText}`, margin, y);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, margin + contentWidth, y + 2);
    y += 8;
  };

  const ensure = (height: number) => {
    if (y + height > bottom) nextPage();
  };

  const section = (title: string) => {
    ensure(12);
    y += 3;
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, 2.2, 5.2, "F");
    useFont(12);
    doc.setTextColor(...INK);
    doc.text(title, margin + 5, y + 4.4);
    y += 8;
  };

  const paintTrend = (points: TrendPoint[]) => {
    const boxH = 64;
    ensure(boxH + 2);
    const top = y;
    doc.setFillColor(250, 251, 253);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, top, contentWidth, boxH, 1.6, 1.6, "FD");
    useFont(8);
    doc.setFillColor(...GREEN);
    doc.circle(margin + 6, top + 5.2, 1.15, "F");
    doc.setTextColor(...INK);
    doc.text("Thu", margin + 9, top + 6.3);
    doc.setFillColor(...RED);
    doc.circle(margin + 24, top + 5.2, 1.15, "F");
    doc.text("Chi", margin + 27, top + 6.3);
    doc.setTextColor(...MUTED);
    doc.text("6 tháng, tính đến tháng này", margin + contentWidth - 4, top + 6.3, { align: "right" });

    const plotLeft = margin + 16;
    const plotRight = margin + contentWidth - 6;
    const plotTop = top + 12;
    const plotBottom = top + 46;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;
    const peak = Math.max(...points.map((point) => Math.max(point.income, point.expense)), 0);
    const max = axisMax(peak);
    const xAt = (index: number) => (points.length <= 1 ? (plotLeft + plotRight) / 2 : plotLeft + (index / (points.length - 1)) * plotW);
    const yAt = (value: number) => plotBottom - (value / max) * plotH;

    doc.setDrawColor(225, 230, 238);
    doc.setLineWidth(0.15);
    for (const tick of [0, 0.5, 1]) {
      const gy = plotBottom - tick * plotH;
      doc.line(plotLeft, gy, plotRight, gy);
      if (peak === 0 && tick !== 0) continue;
      useFont(7);
      doc.setTextColor(...MUTED);
      doc.text(tick === 0 ? "0" : compactVnd(max * tick), plotLeft - 1.6, gy + 0.8, { align: "right" });
    }

    const current = points.findIndex((point) => point.current);
    if (current >= 0 && points.length > 1) {
      const band = (plotW / (points.length - 1)) * 0.62;
      let left = xAt(current) - band / 2;
      if (left < plotLeft) left = plotLeft;
      if (left + band > plotRight) left = plotRight - band;
      doc.setFillColor(235, 242, 255);
      doc.rect(left, plotTop, band, plotH, "F");
      doc.setDrawColor(225, 230, 238);
      doc.setLineWidth(0.15);
      for (const tick of [0, 0.5, 1]) doc.line(plotLeft, plotBottom - tick * plotH, plotRight, plotBottom - tick * plotH);
    }

    const drawSeries = (key: "income" | "expense", color: readonly [number, number, number]) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(0.55);
      points.forEach((point, index) => {
        if (index === 0) return;
        const previous = points[index - 1];
        doc.line(xAt(index - 1), yAt(previous[key]), xAt(index), yAt(point[key]));
      });
      points.forEach((point, index) => {
        const x = xAt(index);
        const py = yAt(point[key]);
        doc.setFillColor(255, 255, 255);
        doc.circle(x, py, point.current ? 1.7 : 1.25, "F");
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(x, py, point.current ? 1.15 : 0.85, "F");
      });
    };
    if (peak > 0) {
      drawSeries("income", GREEN);
      drawSeries("expense", RED);
    } else {
      useFont(8);
      doc.setTextColor(...MUTED);
      doc.text("Chưa có thu chi trong 6 tháng này.", plotLeft, plotTop + plotH / 2);
    }

    useFont(7.5);
    points.forEach((point, index) => {
      const labelColor = point.current ? NAVY : MUTED;
      doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
      doc.text(point.label, xAt(index), plotBottom + 5, { align: "center" });
    });
    y = top + boxH + 3;
  };

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setFillColor(31, 111, 235);
  doc.rect(0, 28, pageWidth, 1.4, "F");
  useFont(16);
  doc.setTextColor(255, 255, 255);
  doc.text(report.heading.toUpperCase(), margin, 13);
  useFont(11);
  doc.text(`${report.scopeLine} · ${report.monthText.toLowerCase()}`, margin, 21);
  useFont(9);
  doc.text(`Ngày xuất ${formatFullDay(todayISO())}`, pageWidth - margin, 21, { align: "right" });
  y = 38;

  if (options.includeBalances) {
    section("Số dư tài khoản");
    ensure(6);
    useFont(8);
    doc.setTextColor(...MUTED);
    doc.text("Số dư là số chung của tài khoản, gồm cả hai sổ.", margin, y + 3);
    y += 5;
    useFont(8);
    doc.setFillColor(244, 247, 251);
    doc.rect(margin, y, contentWidth, 6.5, "F");
    doc.setTextColor(...MUTED);
    doc.text("Tài khoản", margin + 2, y + 4.4);
    doc.text("Số dư", margin + contentWidth - 2, y + 4.4, { align: "right" });
    y += 6.5;
    for (const account of report.accounts) {
      ensure(10);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 9.2, margin + contentWidth, y + 9.2);
      useFont(10);
      doc.setTextColor(...INK);
      doc.text(clip(account.name, contentWidth - 48), margin + 2, y + 4.2);
      doc.text(clip(account.value, 44), margin + contentWidth - 2, y + 4.2, { align: "right" });
      useFont(8);
      doc.setTextColor(...MUTED);
      doc.text(clip(account.detail, contentWidth - 6), margin + 2, y + 8);
      y += 9.4;
    }
  }

  section("1. Tổng hợp thu chi");
  const boxWidth = (contentWidth - 6) / 3;
  const cards: { label: string; value: string; rgb: readonly [number, number, number] }[] = [
    { label: "Tổng thu", value: formatVnd(report.income), rgb: GREEN },
    { label: "Tổng chi", value: formatVnd(report.expense), rgb: RED },
    { label: "Còn lại", value: formatVnd(report.left), rgb: report.left < 0 ? RED : GREEN },
  ];
  ensure(24);
  cards.forEach((card, index) => {
    const x = margin + index * (boxWidth + 3);
    doc.setDrawColor(card.rgb[0], card.rgb[1], card.rgb[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, boxWidth, 18, 1.6, 1.6, "S");
    useFont(8);
    doc.setTextColor(card.rgb[0], card.rgb[1], card.rgb[2]);
    doc.text(card.label, x + 3, y + 6);
    useFont(12);
    doc.text(clip(card.value, boxWidth - 6), x + 3, y + 13);
  });
  y += 22;
  useFont(9);
  const ratioColor = report.ratioBad ? RED : MUTED;
  doc.setTextColor(ratioColor[0], ratioColor[1], ratioColor[2]);
  doc.text(`Chi / Thu  ${report.ratioText}`, margin, y);
  y += 6;

  paintTrend(report.trend);
  const compared = comparisonText(report);
  if (compared) {
    useFont(9);
    const lines = doc.splitTextToSize(compared, contentWidth) as string[];
    ensure(lines.length * 4.4 + 2);
    doc.setTextColor(...INK);
    doc.text(lines, margin, y + 3);
    y += lines.length * 4.4 + 2;
  }

  ensure(8);
  useFont(10);
  doc.setTextColor(...NAVY);
  doc.text("Chi theo danh mục", margin, y + 4);
  y += 6;
  if (report.categories.length === 0) {
    ensure(8);
    useFont(9);
    doc.setTextColor(...MUTED);
    doc.text("Không có khoản chi trong tháng này.", margin, y + 4);
    y += 8;
  } else {
    useFont(8);
    doc.setFillColor(244, 247, 251);
    doc.rect(margin, y, contentWidth, 6.5, "F");
    doc.setTextColor(...MUTED);
    doc.text("Danh mục", margin + 2, y + 4.4);
    doc.text("Số tiền", margin + contentWidth - 2, y + 4.4, { align: "right" });
    y += 6.5;
    for (const row of report.categories) {
      ensure(10);
      doc.setDrawColor(...LINE);
      doc.line(margin, y + 9.2, margin + contentWidth, y + 9.2);
      useFont(10);
      doc.setTextColor(...INK);
      doc.text(clip(row.name, contentWidth - 42), margin + 2, y + 4.2);
      doc.setTextColor(...RED);
      doc.text(formatVnd(row.total), margin + contentWidth - 2, y + 4.2, { align: "right" });
      useFont(8);
      doc.setTextColor(...MUTED);
      doc.text(clip(row.caption, contentWidth - 6), margin + 2, y + 8);
      y += 9.4;
    }
  }

  section("2. Chi tiết từng ngày");
  ensure(6);
  useFont(8);
  doc.setTextColor(...MUTED);
  doc.text("Thu ở cột trái, chi ở cột phải. Chuyển khoản nằm riêng và không tính vào tổng.", margin, y + 3);
  y += 6;

  if (report.days.length === 0) {
    ensure(8);
    useFont(9);
    doc.text("Không có giao dịch trong tháng này.", margin, y + 4);
    y += 8;
  }

  const half = (contentWidth - 4) / 2;
  const paintDayHeader = (day: ReportDay, continued: boolean) => {
    ensure(8);
    doc.setFillColor(244, 247, 251);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, 2, 8, "F");
    useFont(10);
    doc.setTextColor(...INK);
    doc.text(clip(`${day.label}${continued ? "  (tiếp)" : ""}`, contentWidth * 0.48), margin + 5, y + 5.2);
    useFont(8);
    const chi = `Chi ${formatVnd(day.expense)}`;
    const thu = `Thu ${formatVnd(day.income)}`;
    doc.setTextColor(...RED);
    doc.text(chi, margin + contentWidth - 2, y + 5.2, { align: "right" });
    doc.setTextColor(...GREEN);
    doc.text(thu, margin + contentWidth - 4 - doc.getTextWidth(chi), y + 5.2, { align: "right" });
    y += 10;
  };

  const paintCell = (x: number, entry: ReportEntry | undefined, empty: string, tone: "thu" | "chi") => {
    if (!entry && !empty) return;
    const bg = tone === "thu" ? THU_BG : CHI_BG;
    const color = tone === "thu" ? GREEN : RED;
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, y, half, 12, 1.2, 1.2, "F");
    if (!entry) {
      useFont(8);
      doc.setTextColor(...MUTED);
      doc.text(empty, x + 3, y + 7);
      return;
    }
    useFont(9);
    doc.setTextColor(...INK);
    doc.text(clip(entry.title, half - 30), x + 3, y + 5);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(formatVnd(entry.amount), x + half - 2, y + 5, { align: "right" });
    useFont(7.5);
    doc.setTextColor(...MUTED);
    doc.text(clip(entry.meta, half - 6), x + 3, y + 9.4);
  };

  for (const day of report.days) {
    const pairs = Math.max(day.incomeRows.length, day.expenseRows.length);
    if (y + 8 + (pairs > 0 ? 12 : 0) + (day.transfers.length > 0 ? 8 : 0) > bottom) nextPage();
    paintDayHeader(day, false);
    for (let index = 0; index < pairs; index += 1) {
      if (y + 13 > bottom) {
        nextPage();
        paintDayHeader(day, true);
      }
      paintCell(margin, day.incomeRows[index], index === 0 && day.incomeRows.length === 0 ? "Không có khoản thu" : "", "thu");
      paintCell(margin + half + 4, day.expenseRows[index], index === 0 && day.expenseRows.length === 0 ? "Không có khoản chi" : "", "chi");
      y += 13.2;
    }
    for (const transfer of day.transfers) {
      if (y + 8 > bottom) {
        nextPage();
        paintDayHeader(day, true);
      }
      doc.setFillColor(...MOVE_BG);
      doc.roundedRect(margin, y, contentWidth, 7.2, 1.2, 1.2, "F");
      useFont(8);
      doc.setTextColor(...BLUE);
      doc.text("Chuyển", margin + 3, y + 4.6);
      doc.setTextColor(...INK);
      doc.text(clip(`${transfer.title}${transfer.meta ? `  ·  ${transfer.meta}` : ""}`, contentWidth - 46), margin + 20, y + 4.6);
      doc.setTextColor(...BLUE);
      doc.text(formatVnd(transfer.amount), margin + contentWidth - 2, y + 4.6, { align: "right" });
      y += 8.4;
    }
    y += 2;
  }

  paintFooter();
  return doc.output("blob");
}

function entry(data: AppData, tx: Transaction): ReportEntry {
  if (tx.type === "p") {
    return {
      title: `${accountName(data, tx.accountId)} sang ${accountName(data, tx.toAccountId)}`,
      meta: tx.note ?? "",
      amount: tx.amount,
    };
  }
  return {
    title: `${tx.category}${tx.sub ? ` › ${tx.sub}` : ""}`,
    meta: `${accountName(data, tx.accountId)}${tx.note ? ` · ${tx.note}` : ""}`,
    amount: tx.amount,
  };
}

function accountName(data: AppData, id: string | undefined): string {
  return data.accounts.find((account) => account.id === id)?.name ?? "?";
}

function kindLabel(kind: string): string {
  if (kind === "bank") return "Ngân hàng";
  if (kind === "ew") return "Ví điện tử";
  if (kind === "cash") return "Tiền mặt";
  return "";
}

function comparisonText(report: MonthReport): string {
  const current = report.trend.at(-1);
  const previous = report.trend.at(-2);
  if (!current || !previous) return "";
  return `So với ${monthLabel(previous.month)}: thu ${changeWord(current.income - previous.income)}, chi ${changeWord(current.expense - previous.expense)}.`;
}

function changeWord(delta: number): string {
  if (delta === 0) return "không đổi";
  if (delta > 0) return `tăng ${formatVnd(delta)}`;
  return `giảm ${formatVnd(-delta)}`;
}

function axisMax(value: number): number {
  if (value <= 0) return 1;
  const padded = value * 1.15;
  const pow = 10 ** Math.floor(Math.log10(padded));
  const n = padded / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function compactVnd(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${trimNum(abs / 1_000_000)}tr`;
  if (abs >= 1_000) return `${sign}${trimNum(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

function trimNum(value: number): string {
  return (value >= 10 ? value.toFixed(0) : value.toFixed(1)).replace(/\.0$/, "");
}

function weekday(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(year, month - 1, day).getDay()] ?? "";
}
