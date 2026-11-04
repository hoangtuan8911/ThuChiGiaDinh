import { useState, type FormEvent } from "react";
import { formatInputAmount, formatVnd, parseAmount, todayISO } from "../format";
import { useLedger } from "../store";
import type { Account, Entry } from "../types";
import { AmountField, FormError, Modal } from "./ui";

export function AdjustDialog({
  account,
  entry,
  onClose,
}: {
  account: Account;
  entry?: Entry;
  onClose: () => void;
}) {
  const { adjustBalance } = useLedger();
  const isCredit = account.kind === "credit";
  const initial = entry?.balanceAfter ?? account.balance;
  const [next, setNext] = useState(formatInputAmount(String(initial), !isCredit));
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [note, setNote] = useState(entry?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextBalance = parseAmount(next);
    if (nextBalance === null) {
      setError(isCredit ? "Dư nợ không hợp lệ." : "Số dư không hợp lệ.");
      return;
    }
    const result = adjustBalance({
      accountId: account.id,
      nextBalance,
      date,
      note,
      entryId: entry?.id,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  const beforeLabel = entry ? "Trước điều chỉnh" : isCredit ? "Dư nợ hiện tại" : "Số dư hiện tại";
  const beforeValue = entry ? (entry.balanceBefore ?? 0) : account.balance;

  return (
    <Modal title={entry ? "Sửa điều chỉnh" : "Điều chỉnh số dư"} onClose={onClose}>
      <form className="form-grid" onSubmit={onSubmit}>
        <p className="balance-callout span-2">
          <span>
            {account.name} · {beforeLabel}
          </span>
          <strong>{formatVnd(beforeValue)}</strong>
        </p>
        <AmountField
          label={isCredit ? "Dư nợ đúng" : "Số dư đúng"}
          value={next}
          onChange={setNext}
          allowNegative={!isCredit}
        />
        <label className="field">
          <span>Ngày</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field span-2">
          <span>Lý do</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            placeholder="Ví dụ: khớp sao kê cuối tháng"
            autoFocus
          />
        </label>
        <p className="hint span-2">
          {isCredit
            ? "Nhập số nợ thực tế trên thẻ. Lịch sử sẽ ghi lại mức trước và sau."
            : "Nhập số dư thực tế. Lịch sử sẽ ghi lại mức trước và sau."}
        </p>
        <div className="span-2">
          <FormError message={error} />
        </div>
        <div className="form-actions span-2">
          <button type="button" className="btn ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn primary">
            Cập nhật số dư
          </button>
        </div>
      </form>
    </Modal>
  );
}
