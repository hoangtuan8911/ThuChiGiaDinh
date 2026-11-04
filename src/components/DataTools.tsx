import { useRef, useState } from "react";
import { todayISO } from "../format";
import { useLedger } from "../store";
import { parseBackup } from "../storage";
import type { State } from "../types";
import { ConfirmDialog } from "./ui";

export function DataTools() {
  const { state, replaceState, resetAll } = useLedger();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<null | { kind: "reset" } | { kind: "import"; state: State }>(null);

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `so-nha-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Đã tải file sao lưu.");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed) {
      setMessage("Tệp không đúng định dạng sao lưu.");
      return;
    }
    setPending({ kind: "import", state: parsed });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="panel data-panel">
      <div>
        <h2>Dữ liệu trên máy này</h2>
        <p>Sổ lưu trong trình duyệt. Hãy xuất sao lưu trước khi đổi máy hoặc xóa dữ liệu duyệt web.</p>
        {message && <p className="hint">{message}</p>}
      </div>
      <div className="row-actions">
        <button type="button" className="btn" onClick={exportBackup}>
          Xuất sao lưu
        </button>
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          Nhập sao lưu
        </button>
        <button type="button" className="btn danger" onClick={() => setPending({ kind: "reset" })}>
          Xóa toàn bộ
        </button>
        <input
          ref={inputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </div>
      {pending?.kind === "reset" && (
        <ConfirmDialog
          title="Xóa toàn bộ sổ?"
          body="Tài khoản và lịch sử trên trình duyệt này sẽ mất. Danh mục trở về bộ mặc định."
          confirmLabel="Xóa sổ"
          onClose={() => setPending(null)}
          onConfirm={() => {
            resetAll();
            setPending(null);
            setMessage("Đã xóa sổ và khôi phục danh mục mặc định.");
          }}
        />
      )}
      {pending?.kind === "import" && (
        <ConfirmDialog
          title="Nhập bản sao lưu?"
          body="Sổ hiện tại sẽ được thay bằng dữ liệu trong tệp."
          confirmLabel="Nhập và thay sổ"
          onClose={() => setPending(null)}
          onConfirm={() => {
            replaceState(pending.state);
            setPending(null);
            setMessage("Đã nhập sao lưu.");
          }}
        />
      )}
    </section>
  );
}
