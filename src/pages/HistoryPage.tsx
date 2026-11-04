import { useMemo, useState } from "react";
import { AdjustDialog } from "../components/AdjustDialog";
import { EntryDialog } from "../components/EntryDialog";
import { ConfirmDialog, MonthSwitcher } from "../components/ui";
import { currentMonth, formatLongDate, formatMonth, formatVnd, todayISO } from "../format";
import { matchesCategory, presentEntry } from "../ledger";
import { useLedger } from "../store";
import type { Entry, EntryKind } from "../types";

type KindFilter = "all" | EntryKind;

export function HistoryPage() {
  const { state, removeEntry } = useLedger();
  const [month, setMonth] = useState(currentMonth);
  const [allTime, setAllTime] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [removing, setRemoving] = useState<Entry | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return state.entries
      .filter((entry) => (allTime ? true : entry.date.startsWith(month)))
      .filter((entry) => (kind === "all" ? true : entry.kind === kind))
      .filter((entry) => (accountId ? entry.accountId === accountId || entry.counterAccountId === accountId : true))
      .filter((entry) => (categoryId ? matchesCategory(state.categories, entry, categoryId) : true))
      .filter((entry) => {
        if (!q) return true;
        const view = presentEntry(state, entry);
        const hay = `${view.title} ${view.subtitle} ${entry.note} ${entry.categoryName ?? ""}`.toLowerCase();
        if (hay.includes(q)) return true;
        return Boolean(digits) && String(entry.amount).includes(digits);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [state, month, allTime, kind, accountId, categoryId, query]);

  const groups = groupByDate(filtered);
  const roots = state.categories.filter((category) => !category.parentId);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Lịch sử</h1>
          <p className="lede">Mọi khoản thu, chi, chuyển tiền và điều chỉnh số dư đều được giữ lại.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>
          Ghi giao dịch
        </button>
      </header>

      <div className="filters">
        <div className="filter-month">
          {allTime ? <strong>Tất cả các tháng</strong> : <MonthSwitcher month={month} onChange={setMonth} />}
          <button type="button" className="text-btn" onClick={() => setAllTime((value) => !value)}>
            {allTime ? "Xem theo tháng" : "Tất cả"}
          </button>
        </div>
        <label className="field">
          <span>Loại</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
            <option value="all">Mọi loại</option>
            <option value="expense">Chi</option>
            <option value="income">Thu</option>
            <option value="transfer">Chuyển tiền</option>
            <option value="adjustment">Điều chỉnh số dư</option>
          </select>
        </label>
        <label className="field">
          <span>Tài khoản</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Tất cả</option>
            {state.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Danh mục</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Tất cả</option>
            {roots.map((root) => (
              <optgroup key={root.id} label={root.flow === "income" ? `Thu · ${root.name}` : `Chi · ${root.name}`}>
                <option value={root.id}>{root.name}</option>
                {state.categories
                  .filter((category) => category.parentId === root.id)
                  .map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tìm</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ghi chú, danh mục, số tiền" />
        </label>
      </div>

      {filtered.length === 0 ? (
        <section className="empty-hero">
          <h2>Không có giao dịch</h2>
          <p>
            {state.entries.length === 0
              ? "Ghi khoản thu hoặc chi đầu tiên. Số dư tài khoản sẽ đổi theo."
              : `Không có dòng nào khớp bộ lọc${allTime ? "" : ` trong ${formatMonth(month)}`}.`}
          </p>
        </section>
      ) : (
        <div className="history">
          {groups.map(([date, entries]) => {
            const income = sumKind(entries, "income");
            const expense = sumKind(entries, "expense");
            return (
              <section key={date}>
                <header className="day-head">
                  <h2>{formatLongDate(date, todayISO())}</h2>
                  <span className="day-totals">
                    {income > 0 && <span className="day-chip income">Thu +{formatVnd(income)}</span>}
                    {expense > 0 && <span className="day-chip expense">Chi −{formatVnd(expense)}</span>}
                  </span>
                </header>
                <ul className="entry-list">
                  {entries.map((entry) => {
                    const view = presentEntry(state, entry);
                    return (
                      <li key={entry.id} className="entry">
                        <span className="entry-bar" style={{ background: view.color }} />
                        <div className="entry-main">
                          <strong>{view.title}</strong>
                          <small>{view.subtitle}</small>
                        </div>
                        <EntryAmount entry={entry} />
                        <div className="entry-actions">
                          <button type="button" className="text-btn" onClick={() => setEditing(entry)}>
                            Sửa
                          </button>
                          <button type="button" className="text-btn danger" onClick={() => setRemoving(entry)}>
                            Xóa
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {creating && <EntryDialog onClose={() => setCreating(false)} />}
      {editing && editing.kind !== "adjustment" && <EntryDialog entry={editing} onClose={() => setEditing(null)} />}
      {editing && editing.kind === "adjustment" && (
        <AdjustmentEditor entry={editing} onClose={() => setEditing(null)} />
      )}
      {removing && (
        <ConfirmDialog
          title="Xóa giao dịch?"
          body="Dòng này sẽ ra khỏi lịch sử và số dư được tính lại."
          confirmLabel="Xóa giao dịch"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removeEntry(removing.id);
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function AdjustmentEditor({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { state } = useLedger();
  const account = state.accounts.find((item) => item.id === entry.accountId);
  if (!account) {
    return (
      <ConfirmDialog
        title="Tài khoản đã xóa"
        body="Không sửa được điều chỉnh vì tài khoản không còn trong sổ. Dùng nút Xóa trên dòng này nếu muốn bỏ ghi chép."
        confirmLabel="Đóng"
        onClose={onClose}
        onConfirm={onClose}
      />
    );
  }
  return <AdjustDialog account={account} entry={entry} onClose={onClose} />;
}

function EntryAmount({ entry }: { entry: Entry }) {
  if (entry.kind === "adjustment") {
    const before = entry.balanceBefore ?? 0;
    const after = entry.balanceAfter ?? 0;
    const delta = after - before;
    return (
      <div className="entry-amount">
        <strong className="money">{delta > 0 ? `+${formatVnd(delta)}` : formatVnd(delta)}</strong>
        <small>
          {formatVnd(before)} → {formatVnd(after)}
        </small>
      </div>
    );
  }
  if (entry.kind === "income") return <strong className="money income">+{formatVnd(entry.amount)}</strong>;
  if (entry.kind === "expense") return <strong className="money expense">−{formatVnd(entry.amount)}</strong>;
  return <strong className="money">{formatVnd(entry.amount)}</strong>;
}

function sumKind(entries: Entry[], kind: EntryKind): number {
  return entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
}

function groupByDate(entries: Entry[]): [string, Entry[]][] {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const list = groups.get(entry.date) ?? [];
    list.push(entry);
    groups.set(entry.date, list);
  }
  return [...groups.entries()];
}
