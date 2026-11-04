import { useMemo, useState, type FormEvent } from "react";
import { KIND_LABEL } from "../constants";
import { formatVnd, parseAmount, todayISO } from "../format";
import { useLedger } from "../store";
import type { Account, Entry } from "../types";
import { AmountField, FormError, Modal } from "./ui";

type EntryKindChoice = "income" | "expense" | "transfer";

export function EntryDialog({ entry, onClose }: { entry?: Entry; onClose: () => void }) {
  const { state, saveEntry } = useLedger();
  const initialKind: EntryKindChoice = entry && entry.kind !== "adjustment" ? entry.kind : "expense";
  const [kind, setKind] = useState<EntryKindChoice>(initialKind);
  const [amount, setAmount] = useState(entry ? Math.abs(entry.amount).toLocaleString("vi-VN") : "");
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [accountId, setAccountId] = useState(entry?.accountId ?? state.accounts[0]?.id ?? "");
  const [counterAccountId, setCounterAccountId] = useState(entry?.counterAccountId ?? "");
  const [categoryId, setCategoryId] = useState(validCategory(state.categories, entry?.categoryId) ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const flow = kind === "income" ? "income" : "expense";
  const roots = state.categories.filter((category) => category.flow === flow && !category.parentId);
  const destinations = state.accounts.filter((account) => account.id !== accountId);
  const source = state.accounts.find((account) => account.id === accountId);
  const dest = state.accounts.find((account) => account.id === counterAccountId);
  const hint = useMemo(() => impactHint(kind, source, dest), [kind, source, dest]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === null || parsed <= 0) {
      setError("Số tiền phải lớn hơn 0.");
      return;
    }
    const result = saveEntry({
      id: entry?.id,
      kind,
      amount: parsed,
      date,
      accountId,
      counterAccountId: kind === "transfer" ? counterAccountId : null,
      categoryId: kind === "transfer" ? null : categoryId,
      note,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title={entry ? "Sửa giao dịch" : "Ghi giao dịch"} onClose={onClose}>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="segmented span-2" role="radiogroup" aria-label="Loại giao dịch">
          {(
            [
              ["expense", "Chi"],
              ["income", "Thu"],
              ["transfer", "Chuyển tiền"],
            ] as const
          ).map(([option, label]) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              className={kind === option ? "active" : undefined}
              onClick={() => {
                if (option !== kind && option !== "transfer" && kind !== "transfer") setCategoryId("");
                setKind(option);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <AmountField label="Số tiền" value={amount} onChange={setAmount} />
        <label className="field">
          <span>Ngày</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field span-2">
          <span>{kind === "transfer" ? "Từ tài khoản" : "Tài khoản"}</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Chọn tài khoản</option>
            {state.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountOption(account)}
              </option>
            ))}
          </select>
        </label>
        {kind === "transfer" ? (
          <label className="field span-2">
            <span>Đến tài khoản</span>
            <select value={counterAccountId} onChange={(event) => setCounterAccountId(event.target.value)}>
              <option value="">Chọn tài khoản nhận</option>
              {destinations.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountOption(account)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field span-2">
            <span>Danh mục</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Chọn danh mục</option>
              {roots.map((root) => {
                const children = state.categories.filter((category) => category.parentId === root.id);
                return (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name}</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
        )}
        <label className="field span-2">
          <span>Ghi chú</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="Không bắt buộc" />
        </label>
        {hint && <p className="hint span-2">{hint}</p>}
        <div className="span-2">
          <FormError message={error} />
        </div>
        <div className="form-actions span-2">
          <button type="button" className="btn ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn primary" disabled={state.accounts.length === 0}>
            Lưu giao dịch
          </button>
        </div>
      </form>
    </Modal>
  );
}

function accountOption(account: Account): string {
  const balance = account.kind === "credit" ? `nợ ${formatVnd(account.balance)}` : formatVnd(account.balance);
  return `${account.name} · ${KIND_LABEL[account.kind]} · ${balance}`;
}

function validCategory(categories: { id: string }[], id: string | null | undefined): string | null {
  if (!id) return null;
  return categories.some((category) => category.id === id) ? id : null;
}

function impactHint(kind: EntryKindChoice, source?: Account, dest?: Account): string {
  if (!source) return "Hãy thêm tài khoản trước khi ghi giao dịch.";
  if (kind === "expense") {
    return source.kind === "credit" ? "Chi bằng thẻ sẽ tăng dư nợ." : "Khoản chi sẽ trừ vào số dư.";
  }
  if (kind === "income") {
    return source.kind === "credit"
      ? "Khoản thu trên thẻ được tính như hoàn tiền, dư nợ giảm."
      : "Khoản thu sẽ cộng vào số dư.";
  }
  if (!dest) return "Chuyển tiền không tính vào thu hay chi. Cần hai tài khoản.";
  if (dest.kind === "credit") return "Trả thẻ: tiền nguồn giảm, dư nợ thẻ giảm. Không tính là chi tiêu mới.";
  if (source.kind === "credit") return "Đưa tiền từ thẻ sang tài khoản khác: dư nợ tăng, tài khoản nhận tăng.";
  return "Chuyển giữa hai tài khoản, không tính là thu hay chi.";
}
