import { useState } from "react";
import { AccountDialog } from "../components/AccountDialog";
import { AdjustDialog } from "../components/AdjustDialog";
import { ConfirmDialog } from "../components/ui";
import { KIND_LABEL } from "../constants";
import { formatVnd } from "../format";
import { useLedger } from "../store";
import type { Account, AccountKind } from "../types";

const GROUPS: { kind: AccountKind; title: string }[] = [
  { kind: "bank", title: "Ngân hàng" },
  { kind: "credit", title: "Thẻ tín dụng" },
  { kind: "ewallet", title: "Ví điện tử" },
];

export function AccountsPage() {
  const { state, removeAccount } = useLedger();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [adjusting, setAdjusting] = useState<Account | null>(null);
  const [removing, setRemoving] = useState<Account | null>(null);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tài khoản</h1>
          <p className="lede">
            Ngân hàng, thẻ tín dụng và ví điện tử. Số dư thẻ là dư nợ: chi thẻ làm nợ tăng, trả thẻ làm nợ giảm.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>
          Thêm tài khoản
        </button>
      </header>

      {state.accounts.length === 0 && (
        <section className="empty-hero">
          <h2>Chưa có tài khoản</h2>
          <p>Thêm tài khoản đầu tiên để bắt đầu ghi thu chi.</p>
        </section>
      )}

      {GROUPS.map((group) => {
        const accounts = state.accounts.filter((account) => account.kind === group.kind);
        if (accounts.length === 0) return null;
        const total = accounts.reduce((sum, account) => sum + account.balance, 0);
        return (
          <section key={group.kind} className="stack">
            <header className="panel-head">
              <h2>{group.title}</h2>
              <span className="muted">
                {group.kind === "credit" ? "Tổng dư nợ" : "Tổng số dư"} {formatVnd(total)}
              </span>
            </header>
            <div className="card-grid">
              {accounts.map((account) => (
                <article key={account.id} className="account-card" style={{ borderTopColor: account.color }}>
                  <div className="account-kicker">
                    <span className="pill">{KIND_LABEL[account.kind]}</span>
                    {account.institution && <span className="muted">{account.institution}</span>}
                  </div>
                  <h3>{account.name}</h3>
                  <p className="account-balance">{formatVnd(account.balance)}</p>
                  <p className="muted">{account.kind === "credit" ? "Dư nợ" : "Số dư"}</p>
                  {account.kind === "credit" && account.creditLimit != null && (
                    <LimitMeter balance={account.balance} limit={account.creditLimit} color={account.color} />
                  )}
                  {account.note && <p className="account-note">{account.note}</p>}
                  <div className="row-actions">
                    <button type="button" className="btn small" onClick={() => setAdjusting(account)}>
                      Điều chỉnh
                    </button>
                    <button type="button" className="btn small" onClick={() => setEditing(account)}>
                      Sửa
                    </button>
                    <button type="button" className="btn small danger" onClick={() => setRemoving(account)}>
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {creating && <AccountDialog onClose={() => setCreating(false)} />}
      {editing && <AccountDialog account={editing} onClose={() => setEditing(null)} />}
      {adjusting && <AdjustDialog account={adjusting} onClose={() => setAdjusting(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Xóa ${removing.name}?`}
          body="Lịch sử giao dịch vẫn được giữ. Số dư của tài khoản này sẽ không còn trong sổ."
          confirmLabel="Xóa tài khoản"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removeAccount(removing.id);
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function LimitMeter({ balance, limit, color }: { balance: number; limit: number; color: string }) {
  const ratio = limit > 0 ? balance / limit : 1;
  const over = balance > limit;
  const width = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className="limit">
      <div className="util" aria-hidden="true">
        <span style={{ width: `${width}%`, background: over ? "#b42318" : color }} />
      </div>
      <p className="muted">
        {over
          ? `Vượt hạn mức ${formatVnd(balance - limit)}`
          : `Còn ${formatVnd(limit - balance)} trong hạn mức ${formatVnd(limit)}`}
      </p>
    </div>
  );
}
