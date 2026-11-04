import { useEffect, useId, type ReactNode } from "react";
import { PALETTE } from "../constants";
import { formatInputAmount, formatMonth, shiftMonth } from "../format";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-copy">{body}</p>
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          Hủy
        </button>
        <button type="button" className="btn danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function AmountField({
  label,
  value,
  onChange,
  allowNegative = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowNegative?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="amount-input">
        <input
          inputMode={allowNegative ? "text" : "numeric"}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(formatInputAmount(event.target.value, allowNegative))}
        />
        <span>₫</span>
      </span>
    </label>
  );
}

export function ColorField({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const customId = useId();
  return (
    <div className="field">
      <span>Màu</span>
      <div className="swatches">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className={color.toLowerCase() === value.toLowerCase() ? "swatch active" : "swatch"}
            style={{ background: color }}
            aria-label={`Màu ${color}`}
            aria-pressed={color.toLowerCase() === value.toLowerCase()}
            onClick={() => onChange(color)}
          />
        ))}
        <label className="swatch custom" htmlFor={customId}>
          <span className="sr-only">Màu tùy chọn</span>
          <input id={customId} type="color" value={toColorInput(value)} onChange={(event) => onChange(event.target.value)} />
        </label>
      </div>
    </div>
  );
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="month-switch">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Tháng trước">
        ‹
      </button>
      <span>{formatMonth(month)}</span>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Tháng sau">
        ›
      </button>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}

function toColorInput(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1d4ed8";
}
