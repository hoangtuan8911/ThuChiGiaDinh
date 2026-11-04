import { useState } from "react";
import { monthSeries, type MonthPoint } from "./calc";
import { formatVnd, monthLabel, shiftMonth } from "./money";
import type { Transaction } from "./types";

type Preset = "3" | "6" | "12" | "year";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "3", label: "3 tháng" },
  { id: "6", label: "6 tháng" },
  { id: "12", label: "12 tháng" },
  { id: "year", label: "Cả năm" },
];

export function ReportSheet({ transactions, endMonth, onClose }: { transactions: Transaction[]; endMonth: string; onClose: () => void }) {
  const initial = rangeFor("6", endMonth);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const { points, truncated } = monthSeries(transactions, from, to);
  const income = points.reduce((sum, point) => sum + point.income, 0);
  const expense = points.reduce((sum, point) => sum + point.expense, 0);
  const left = income - expense;
  const months = points.length || 1;
  const multiYear = new Set(points.map((point) => point.month.slice(0, 4))).size > 1;
  const peak = Math.max(1, ...points.map((point) => Math.max(point.income, point.expense)));
  const topIncome = peakPoint(points, "income");
  const topExpense = peakPoint(points, "expense");
  const last = points.at(-1);
  const previous = points.at(-2);
  const compareText = last && previous && points.some((point) => point.income > 0 || point.expense > 0) ? compareExpense(last, previous) : "";

  return (
    <>
      <h3>📊 Thu chi theo tháng</h3>
      <small className="hint">Chuyển khoản không tính là thu hay chi. Cột xanh là thu, cột đỏ là chi.</small>
      <div className="presets">
        {PRESETS.map((preset) => {
          const range = rangeFor(preset.id, to || endMonth);
          const on = range.from === from && range.to === to;
          return (
            <button key={preset.id} type="button" className={on ? "on" : ""} onClick={() => { setFrom(range.from); setTo(range.to); }}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="g2">
        <div>
          <label htmlFor="report-from">Từ tháng</label>
          <input id="report-from" type="month" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div>
          <label htmlFor="report-to">Đến tháng</label>
          <input id="report-to" type="month" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>
      {truncated && <small className="hint">Khoảng này dài hơn 4 năm. Biểu đồ vẽ 48 tháng gần nhất.</small>}
      {points.length === 0 ? (
        <div className="empty">Chọn đủ tháng bắt đầu và tháng kết thúc.</div>
      ) : (
        <>
          <div className="legend">
            <span><i className="thu" /> Thu</span>
            <span><i className="chi" /> Chi</span>
          </div>
          <div className="chart-scroll">
            <div className="chart-plot" style={{ minWidth: points.length * 48 }}>
              {points.map((point) => (
                <div key={point.month} className={point.month === endMonth ? "chart-col now" : "chart-col"}>
                  <div className="chart-bars" aria-hidden="true">
                    <i className="thu" style={{ height: barHeight(point.income, peak) }} />
                    <i className="chi" style={{ height: barHeight(point.expense, peak) }} />
                  </div>
                  <small>{axisLabel(point.month, multiYear)}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap">
            <div className="c thu"><small>Tổng thu</small><div className="v">{formatVnd(income)}</div></div>
            <div className="c chi"><small>Tổng chi</small><div className="v">{formatVnd(expense)}</div></div>
            <div className={`c ${left < 0 ? "bad" : "ok"}`}><small>Còn lại</small><div className="v">{left < 0 ? "⚠ " : ""}{formatVnd(left)}</div></div>
            <div className="c"><small>Chi trung bình</small><div className="v">{formatVnd(expense / months)}</div></div>
          </div>
          {(topExpense || topIncome || compareText) && (
            <div className="compare">
              {topExpense && <p>Chi nhiều nhất: {monthLabel(topExpense.month)} · {formatVnd(topExpense.expense)}</p>}
              {topIncome && <p>Thu nhiều nhất: {monthLabel(topIncome.month)} · {formatVnd(topIncome.income)}</p>}
              {compareText && <p>{compareText}</p>}
            </div>
          )}
          <div className="list gap">
            {points.map((point) => (
              <div key={point.month} className="row">
                <div className="l">
                  <b>{monthLabel(point.month)}</b>
                  <small>Còn {point.left < 0 ? "⚠ " : ""}{formatVnd(point.left)}</small>
                </div>
                <span className="report-amts">
                  <span className="amt t">+{formatVnd(point.income)}</span>
                  <span className="amt x">−{formatVnd(point.expense)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="btns"><button type="button" className="b1" onClick={onClose}>Đóng</button></div>
    </>
  );
}

function rangeFor(preset: Preset, end: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}$/.test(end)) return { from: end, to: end };
  if (preset === "year") return { from: `${end.slice(0, 4)}-01`, to: end };
  const back = preset === "3" ? 2 : preset === "6" ? 5 : 11;
  return { from: shiftMonth(end, -back), to: end };
}

function axisLabel(month: string, multiYear: boolean): string {
  const [year, mon] = month.split("-");
  const label = `T${Number(mon)}`;
  return multiYear ? `${label}/${year.slice(2)}` : label;
}

function barHeight(value: number, peak: number): string {
  if (value <= 0) return "0";
  return `max(4px, ${(value / peak) * 100}%)`;
}

function peakPoint(points: MonthPoint[], key: "income" | "expense"): MonthPoint | null {
  let best: MonthPoint | null = null;
  for (const point of points) {
    if (point[key] <= 0) continue;
    if (!best || point[key] > best[key]) best = point;
  }
  return best;
}

function compareExpense(last: MonthPoint, previous: MonthPoint): string {
  const delta = last.expense - previous.expense;
  const current = monthLabel(last.month);
  const prior = monthLabel(previous.month);
  if (delta === 0) return `${current} chi bằng ${prior.replace("Tháng", "tháng")}.`;
  const direction = delta > 0 ? "nhiều hơn" : "ít hơn";
  return `${current} chi ${direction} ${prior.replace("Tháng", "tháng")} ${formatVnd(Math.abs(delta))}.`;
}
