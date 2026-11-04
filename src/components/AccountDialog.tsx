import { useId, useState, type FormEvent } from "react";
import { BANK_NAMES, KIND_LABEL, WALLET_NAMES } from "../constants";
import { formatInputAmount, parseAmount, todayISO } from "../format";
import { useLedger } from "../store";
import type { Account, AccountKind } from "../types";
import { AmountField, ColorField, FormError, Modal } from "./ui";

export function AccountDialog({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { createAccount, updateAccount } = useLedger();
  const editing = Boolean(account);
  const listId = useId();
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "bank");
  const [name, setName] = useState(account?.name ?? "");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [opening, setOpening] = useState("");
  const [date, setDate] = useState(todayISO());
  const [limit, setLimit] = useState(
    account?.creditLimit != null ? formatInputAmount(String(account.creditLimit), false) : "",
  );
  const [color, setColor] = useState(account?.color ?? "#1d4ed8");
  const [note, setNote] = useState(account?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const suggestions = kind === "ewallet" ? WALLET_NAMES : BANK_NAMES;
  const institutionLabel = kind === "ewallet" ? "Ví" : kind === "credit" ? "Ngân hàng phát hành" : "Ngân hàng";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const creditLimit = limit.trim() ? parseAmount(limit) : null;
    if (limit.trim() && (creditLimit === null || creditLimit < 0)) {
      setError("Hạn mức không hợp lệ.");
      return;
    }
    if (editing && account) {
      const result = updateAccount({
        id: account.id,
        name,
        institution,
        color,
        note,
        creditLimit: account.kind === "credit" ? creditLimit : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      return;
    }

    const openingBalance = opening.trim() ? parseAmount(opening) : 0;
    if (openingBalance === null) {
      setError(kind === "credit" ? "Dư nợ không hợp lệ." : "Số dư không hợp lệ.");
      return;
    }
    const result = createAccount({
      name,
      kind,
      institution,
      color,
      note,
      openingBalance,
      creditLimit: kind === "credit" ? creditLimit : null,
      date,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal title={editing ? "Sửa tài khoản" : "Thêm tài khoản"} onClose={onClose}>
      <form className="form-grid" onSubmit={onSubmit}>
        {editing && account ? (
          <p className="hint span-2">
            {KIND_LABEL[account.kind]}. Đổi số dư bằng nút Điều chỉnh trên thẻ tài khoản.
          </p>
        ) : (
          <div className="segmented span-2" role="radiogroup" aria-label="Loại tài khoản">
            {(["bank", "credit", "ewallet"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={kind === option}
                className={kind === option ? "active" : undefined}
                onClick={() => {
                  setKind(option);
                  if (option === "credit" && opening.startsWith("-")) setOpening(opening.slice(1));
                }}
              >
                {KIND_LABEL[option]}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>Tên gợi nhớ</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Vietcombank lương" autoFocus />
        </label>
        <label className="field">
          <span>{institutionLabel}</span>
          <input
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            list={listId}
            placeholder={suggestions[0]}
          />
          <datalist id={listId}>
            {suggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        {!editing && (
          <>
            <AmountField
              label={kind === "credit" ? "Dư nợ hiện tại" : "Số dư ban đầu"}
              value={opening}
              onChange={setOpening}
              allowNegative={kind !== "credit"}
            />
            <label className="field">
              <span>Ngày ghi nhận</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
          </>
        )}
        {(editing ? account?.kind === "credit" : kind === "credit") && (
          <div className="span-2">
            <AmountField label="Hạn mức" value={limit} onChange={setLimit} />
          </div>
        )}
        <div className="span-2">
          <ColorField value={color} onChange={setColor} />
        </div>
        <label className="field span-2">
          <span>Ghi chú</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} placeholder="Không bắt buộc" />
        </label>
        <div className="span-2">
          <FormError message={error} />
        </div>
        <div className="form-actions span-2">
          <button type="button" className="btn ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn primary">
            Lưu
          </button>
        </div>
      </form>
    </Modal>
  );
}
