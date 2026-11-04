import { useState } from "react";
import { AccountDialog } from "../components/AccountDialog";
import { DataTools } from "../components/DataTools";
import { EntryDialog } from "../components/EntryDialog";
import { MonthSwitcher } from "../components/ui";
import { KIND_LABEL } from "../constants";
import { currentMonth, formatLongDate, formatVnd } from "../format";
import { expenseByCategory, monthFlow, presentEntry, wealth } from "../ledger";
import { useGo } from "../nav";
import { useLedger } from "../store";

export function OverviewPage() {
  const { state, loadSample } = useLedger();
  const go = useGo();
  const [month, setMonth] = useState(currentMonth);
  const [accountOpen, setAccountOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const flow = monthFlow(state.entries, month);
  const money = wealth(state.accounts);
  const spent = expenseByCategory(state, month);
  const maxSpent = spent[0]?.total ?? 0;
  const recent = state.entries
    .filter((entry) => entry.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  if (state.accounts.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <h1>Tổng quan</h1>
            <p className="lede">Sổ thu chi của cả nhà: tiền đang có, thẻ đang nợ, và từng khoản đã ghi.</p>
          </div>
        </header>
        <section className="empty-hero">
          <h2>Bắt đầu sổ của gia đình</h2>
          <p>Thêm ngân hàng, thẻ tín dụng hoặc ví điện tử. Mỗi khoản thu chi sau đó tự cập nhật số dư.</p>
          <div className="row-actions">
            <button type="button" className="btn primary" onClick={() => setAccountOpen(true)}>
              Thêm tài khoản
            </button>
            {state.entries.length === 0 && (
              <button type="button" className="btn" onClick={loadSample}>
                Xem dữ liệu mẫu
              </button>
            )}
          </div>
        </section>
        <DataTools />
        {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tổng quan</h1>
          <p className="lede">Tiền của gia đình và các khoản đã ghi trong tháng đang xem.</p>
        </div>
        <div className="page-actions">
          <MonthSwitcher month={month} onChange={setMonth} />
          <button type="button" className="btn primary" onClick={() => setEntryOpen(true)}>
            Ghi giao dịch
          </button>
        </div>
      </header>

      <section className="hero-layout">
        <article className="hero">
          <p className="eyebrow">Tài sản ròng</p>
          <p className="hero-value">{formatVnd(money.net)}</p>
          <p className="hero-meta">
            Tiền sẵn có {formatVnd(money.cash)}
            {money.debt > 0 ? ` · Dư nợ thẻ ${formatVnd(money.debt)}` : ""}
          </p>
        </article>
        <div className="stat-grid">
          <Stat label="Thu trong tháng" value={formatVnd(flow.income)} tone="income" />
          <Stat label="Chi trong tháng" value={formatVnd(flow.expense)} tone="expense" />
          <Stat label="Còn lại" value={formatVnd(flow.net)} tone={flow.net >= 0 ? "income" : "expense"} />
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Tài khoản</h2>
          <button type="button" className="text-btn" onClick={() => go("accounts")}>
            Quản lý
          </button>
        </header>
        <ul className="account-brief">
          {state.accounts.map((account) => (
            <li key={account.id}>
              <span className="dot" style={{ background: account.color }} />
              <div>
                <strong>{account.name}</strong>
                <small>
                  {KIND_LABEL[account.kind]}
                  {account.institution ? ` · ${account.institution}` : ""}
                </small>
              </div>
              <div className="brief-balance">
                <strong>{formatVnd(account.balance)}</strong>
                <small>{account.kind === "credit" ? "dư nợ" : "số dư"}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="columns">
        <article className="panel">
          <header className="panel-head">
            <h2>Chi theo danh mục</h2>
          </header>
          {spent.length === 0 ? (
            <p className="muted">Chưa có khoản chi trong tháng này.</p>
          ) : (
            <ul className="bar-list">
              {spent.map((row) => {
                const width = maxSpent ? Math.max(6, (row.total / maxSpent) * 100) : 0;
                const share = flow.expense ? Math.round((row.total / flow.expense) * 100) : 0;
                return (
                  <li key={row.id} className="bar-row">
                    <span className="dot" style={{ background: row.color }} />
                    <span className="bar-name">{row.name}</span>
                    <span className="bar-share">{share}%</span>
                    <span className="bar-track" aria-hidden="true">
                      <span style={{ width: `${width}%`, background: row.color }} />
                    </span>
                    <span className="bar-amt">{formatVnd(row.total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
        <article className="panel">
          <header className="panel-head">
            <h2>Giao dịch trong tháng</h2>
            <button type="button" className="text-btn" onClick={() => go("history")}>
              Xem lịch sử
            </button>
          </header>
          {recent.length === 0 ? (
            <p className="muted">Chưa có giao dịch trong tháng này.</p>
          ) : (
            <ul className="recent-list">
              {recent.map((entry) => {
                const view = presentEntry(state, entry);
                return (
                  <li key={entry.id}>
                    <span className="dot" style={{ background: view.color }} />
                    <div>
                      <strong>{view.title}</strong>
                      <small>
                        {formatLongDate(entry.date)} · {view.subtitle}
                      </small>
                    </div>
                    <Amount entryKind={entry.kind} amount={entry.amount} />
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </section>

      <DataTools />
      {accountOpen && <AccountDialog onClose={() => setAccountOpen(false)} />}
      {entryOpen && <EntryDialog onClose={() => setEntryOpen(false)} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "income" | "expense" }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <strong className={tone}>{value}</strong>
    </article>
  );
}

function Amount({ entryKind, amount }: { entryKind: string; amount: number }) {
  if (entryKind === "income") return <em className="money income">+{formatVnd(amount)}</em>;
  if (entryKind === "expense") return <em className="money expense">−{formatVnd(amount)}</em>;
  return <em className="money">{formatVnd(amount)}</em>;
}
