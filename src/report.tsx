import { useState } from "react";
import { daySeries, monthSeries, type MonthPoint } from "./calc";
import { formatVnd, monthLabel, shiftMonth } from "./money";
import { REPORT_SCOPE_LABEL, type LedgerScope, type ReportScope, type Transaction } from "./types";

type Mode = "month" | "range";
type Preset = "3" | "6" | "12" | "year";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "3", label: "3 tháng" },
  { id: "6", label: "6 tháng" },
  { id: "12", label: "12 tháng" },
  { id: "year", label: "Cả năm" },
];

export function ReportSheet({ transactions, endMonth, today, initialScope, onClose }: { transactions: Transaction[]; endMonth: string; today: string; initialScope: LedgerScope; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("month");
  const [scope, setScope] = useState<ReportScope>(initialScope);
  const [dayMonth, setDayMonth] = useState(endMonth);
  const initial = rangeFor("6", endMonth);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const scoped = scope === "all" ? transactions : transactions.filter((tx) => tx.scope === scope);

  return (
    <>
      <h3>📊 Báo cáo</h3>
      <div className="seg three">
        <button type="button" className={scope === "family" ? "on p" : ""} onClick={() => setScope("family")}>{REPORT_SCOPE_LABEL.family}</button>
        <button type="button" className={scope === "personal" ? "on p" : ""} onClick={() => setScope("personal")}>{REPORT_SCOPE_LABEL.personal}</button>
        <button type="button" className={scope === "all" ? "on p" : ""} onClick={() => setScope("all")}>{REPORT_SCOPE_LABEL.all}</button>
      </div>
      <div className="seg">
        <button type="button" className={mode === "month" ? "on p" : ""} onClick={() => setMode("month")}>Theo tháng</button>
        <button type="button" className={mode === "range" ? "on p" : ""} onClick={() => setMode("range")}>Theo khoảng</button>
      </div>
      <small className="hint">
        {scope === "all" ? "Đang xem tổng cả hai sổ." : `Đang xem sổ ${REPORT_SCOPE_LABEL[scope].toLowerCase()}.`} Chuyển khoản không tính là thu hay chi. Cột xanh là thu, cột đỏ là chi.
      </small>
      {mode === "month" ? (
        <MonthDays transactions={scoped} month={dayMonth} today={today} onMonth={setDayMonth} />
      ) : (
        <MonthRange transactions={scoped} endMonth={endMonth} from={from} to={to} onFrom={setFrom} onTo={setTo} />
      )}
      <div className="btns"><button type="button" className="b1" onClick={onClose}>Đóng</button></div>
    </>
  );
}

function MonthDays({ transactions, month, today, onMonth }: { transactions: Transaction[]; month: string; today: string; onMonth: (month: string) => void }) {
  const points = daySeries(transactions, month);
  const active = points.filter((point) => point.income > 0 || point.expense > 0);
  const income = points.reduce((sum, point) => sum + point.income, 0);
  const expense = points.reduce((sum, point) => sum + point.expense, 0);
  const topIncome = peakPoint(points, "income");
  const topExpense = peakPoint(points, "expense");
  return (
    <>
      <div className="mn sheet">
        <button type="button" aria-label="Tháng trước" onClick={() => onMonth(shiftMonth(month, -1))}>◀</button>
        <b>{monthLabel(month)}</b>
        <button type="button" aria-label="Tháng sau" onClick={() => onMonth(shiftMonth(month, 1))}>▶</button>
      </div>
      {points.length === 0 ? (
        <div className="empty">Chọn một tháng.</div>
      ) : (
        <>
          <ColumnChart
            width={28}
            items={points.map((point) => ({
              key: point.date,
              label: String(Number(point.date.slice(8, 10))),
              income: point.income,
              expense: point.expense,
              current: point.date === today,
              narrow: true,
            }))}
          />
          <Totals income={income} expense={expense} averageLabel="Chi trung bình / ngày" periods={points.length} />
          {(topExpense || topIncome) && (
            <div className="compare">
              {topExpense && <p>Chi nhiều nhất: {dayName(topExpense.date)} · {formatVnd(topExpense.expense)}</p>}
              {topIncome && <p>Thu nhiều nhất: {dayName(topIncome.date)} · {formatVnd(topIncome.income)}</p>}
            </div>
          )}
          <div className="list gap">
            {active.length === 0 && <div className="empty">Chưa có thu chi trong tháng này.</div>}
            {active.map((point) => (
              <AmountRow key={point.date} title={dayName(point.date)} left={point.left} income={point.income} expense={point.expense} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function MonthRange({ transactions, endMonth, from, to, onFrom, onTo }: { transactions: Transaction[]; endMonth: string; from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  const { points, truncated } = monthSeries(transactions, from, to);
  const income = points.reduce((sum, point) => sum + point.income, 0);
  const expense = points.reduce((sum, point) => sum + point.expense, 0);
  const multiYear = new Set(points.map((point) => point.month.slice(0, 4))).size > 1;
  const topIncome = peakPoint(points, "income");
  const topExpense = peakPoint(points, "expense");
  const last = points.at(-1);
  const previous = points.at(-2);
  const compareText = last && previous && points.some((point) => point.income > 0 || point.expense > 0) ? compareExpense(last, previous) : "";
  return (
    <>
      <div className="presets">
        {PRESETS.map((preset) => {
          const range = rangeFor(preset.id, to || endMonth);
          const on = range.from === from && range.to === to;
          return (
            <button key={preset.id} type="button" className={on ? "on" : ""} onClick={() => { onFrom(range.from); onTo(range.to); }}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="g2">
        <div>
          <label htmlFor="report-from">Từ tháng</label>
          <input id="report-from" type="month" value={from} onChange={(event) => onFrom(event.target.value)} />
        </div>
        <div>
          <label htmlFor="report-to">Đến tháng</label>
          <input id="report-to" type="month" value={to} onChange={(event) => onTo(event.target.value)} />
        </div>
      </div>
      {truncated && <small className="hint">Khoảng này dài hơn 4 năm. Biểu đồ vẽ 48 tháng gần nhất.</small>}
      {points.length === 0 ? (
        <div className="empty">Chọn đủ tháng bắt đầu và tháng kết thúc.</div>
      ) : (
        <>
          <ColumnChart
            width={48}
            items={points.map((point) => ({
              key: point.month,
              label: axisLabel(point.month, multiYear),
              income: point.income,
              expense: point.expense,
              current: point.month === endMonth,
              narrow: false,
            }))}
          />
          <Totals income={income} expense={expense} averageLabel="Chi trung bình / tháng" periods={points.length} />
          {(topExpense || topIncome || compareText) && (
            <div className="compare">
              {topExpense && <p>Chi nhiều nhất: {monthLabel(topExpense.month)} · {formatVnd(topExpense.expense)}</p>}
              {topIncome && <p>Thu nhiều nhất: {monthLabel(topIncome.month)} · {formatVnd(topIncome.income)}</p>}
              {compareText && <p>{compareText}</p>}
            </div>
          )}
          <div className="list gap">
            {points.map((point) => (
              <AmountRow key={point.month} title={monthLabel(point.month)} left={point.left} income={point.income} expense={point.expense} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ColumnChart({ items, width }: { items: { key: string; label: string; income: number; expense: number; current: boolean; narrow: boolean }[]; width: number }) {
  const peak = Math.max(1, ...items.map((item) => Math.max(item.income, item.expense)));
  return (
    <>
      <div className="legend">
        <span><i className="thu" /> Thu</span>
        <span><i className="chi" /> Chi</span>
      </div>
      <div className="chart-scroll">
        <div className="chart-plot" style={{ minWidth: items.length * width }}>
          {items.map((item) => (
            <div key={item.key} className={item.current ? "chart-col now" : "chart-col"} style={{ flexBasis: width, minWidth: width }}>
              <div className="chart-bars" aria-hidden="true">
                <i className="thu" style={{ height: barHeight(item.income, peak), width: item.narrow ? 8 : 12 }} />
                <i className="chi" style={{ height: barHeight(item.expense, peak), width: item.narrow ? 8 : 12 }} />
              </div>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Totals({ income, expense, averageLabel, periods }: { income: number; expense: number; averageLabel: string; periods: number }) {
  const left = income - expense;
  const count = periods || 1;
  return (
    <div className="grid gap">
      <div className="c thu"><small>Tổng thu</small><div className="v">{formatVnd(income)}</div></div>
      <div className="c chi"><small>Tổng chi</small><div className="v">{formatVnd(expense)}</div></div>
      <div className={`c ${left < 0 ? "bad" : "ok"}`}><small>Còn lại</small><div className="v">{left < 0 ? "⚠ " : ""}{formatVnd(left)}</div></div>
      <div className="c"><small>{averageLabel}</small><div className="v">{formatVnd(expense / count)}</div></div>
    </div>
  );
}

function AmountRow({ title, left, income, expense }: { title: string; left: number; income: number; expense: number }) {
  return (
    <div className="row">
      <div className="l">
        <b>{title}</b>
        <small>Còn {left < 0 ? "⚠ " : ""}{formatVnd(left)}</small>
      </div>
      <span className="report-amts">
        <span className="amt t">+{formatVnd(income)}</span>
        <span className="amt x">−{formatVnd(expense)}</span>
      </span>
    </div>
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

function dayName(date: string): string {
  return `Ngày ${Number(date.slice(8, 10))}`;
}

function barHeight(value: number, peak: number): string {
  if (value <= 0) return "0";
  return `max(4px, ${(value / peak) * 100}%)`;
}

function peakPoint<T extends { income: number; expense: number }>(points: T[], key: "income" | "expense"): T | null {
  let best: T | null = null;
  for (const point of points) {
    if (point[key] <= 0) continue;
    if (!best || point[key] > best[key]) best = point;
  }
  return best;
}

function compareExpense(last: MonthPoint, previous: MonthPoint): string {
  const delta = last.expense - previous.expense;
  const current = monthLabel(last.month);
  const prior = monthLabel(previous.month).replace("Tháng", "tháng");
  if (delta === 0) return `${current} chi bằng ${prior}.`;
  const direction = delta > 0 ? "nhiều hơn" : "ít hơn";
  return `${current} chi ${direction} ${prior} ${formatVnd(Math.abs(delta))}.`;
}
