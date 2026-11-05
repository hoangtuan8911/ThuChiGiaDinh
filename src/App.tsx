import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  accountSnapshots,
  allCategories,
  backupAgeDays,
  categoryColor,
  categorySpend,
  monthTotals,
  moveWithinDay,
  screenOrder,
  type AccountSnapshot,
} from "./calc";
import fontUrl from "./fonts/Roboto-Regular.ttf?url";
import { currentMonth, formatDay, formatFullDay, formatVnd, monthLabel, shiftMonth, todayISO } from "./money";
import {
  addCategory,
  addSub,
  deleteAccount,
  deleteCategory,
  deleteSub,
  deleteTransaction,
  moveTransaction,
  listOf,
  renameCategory,
  renameSub,
  saveAccount,
  saveBudgets,
  saveTransaction,
  setCategoryColor,
  type AccountInput,
  type Result,
} from "./mutate";
import { normalize } from "./migrate";
import { ReportSheet } from "./report";
import { SOURCE } from "./source";
import { storageNotice } from "./browserNotice";
import { currentRevision, loadAppData, loadMirror, loadUndo, mirrorCurrent, rememberRevision, saveAppData, saveUndo } from "./storage";
import { REPORT_SCOPE_LABEL, SCOPE_LABEL, type Account, type AccountKind, type AppData, type Flow, type LedgerScope, type ReportScope, type Tone, type Transaction, type TxType } from "./types";

const KIND_ICON: Record<AccountKind, string> = { bank: "🏦", ew: "📱", cash: "💵", cr: "💳" };

const HELP: { title: string; body: string }[] = [
  { title: "Hai sổ", body: "Nút Gia đình và Cá nhân ở đầu trang. Mỗi sổ có danh mục cha, danh mục con, ngân sách và giao dịch riêng. Số dư tài khoản là số chung của cả hai sổ." },
  { title: "Nhập liệu ngay trên trang chủ", body: "Chọn sổ Gia đình hoặc Cá nhân, rồi chọn Thu, Chi hoặc Chuyển. Số tiền gõ nhanh: 50k, 1.5tr, 150.000. Chọn ngày, danh mục rồi bấm Lưu." },
  { title: "Sửa, xóa, sắp xếp", body: "Chạm một giao dịch để đưa lên form. ▲ ▼ đổi chỗ với giao dịch liền kề trong cùng ngày. Nút Chuyển sang Cá nhân hoặc Gia đình đưa khoản đó sang sổ kia, kể cả khoản đã nhập từ trước." },
  { title: "Chuyển tháng", body: "Nút ◀ ▶ đổi tháng đang xem. Số dư tài khoản là số đến hiện tại, không phụ thuộc tháng." },
  { title: "Ẩn số", body: "Tổng thu chi và số dư tài khoản được giấu. Bấm Xem khi cần nhìn, bấm Ẩn để giấu lại." },
  { title: "Danh mục", body: "Mỗi sổ có danh mục riêng. Thêm, đổi tên, đổi màu, xóa danh mục cha và danh mục con của sổ đang chọn. Đổi tên cập nhật giao dịch cũ và ngân sách của sổ đó. Xóa danh mục không xóa giao dịch cũ." },
  { title: "Tài khoản", body: "Ngân hàng, ví điện tử, tiền mặt và thẻ tín dụng. Thẻ nhập dư nợ ban đầu và hạn mức. Khả dụng = hạn mức − dư nợ, không cộng vào số dư các tài khoản khác. Tài khoản đã có giao dịch thì không xóa được." },
  { title: "Chuyển khoản", body: "Dùng để trả thẻ hoặc chuyển giữa các tài khoản. Không tính là thu hay chi." },
  { title: "Ngân sách", body: "Hạn mức chi mỗi tháng cho từng danh mục cha của sổ đang chọn. Dưới 80% bình thường, từ 80% đến 100% là Sát mức (cam), trên 100% là VƯỢT (đỏ)." },
  { title: "Cảnh báo màu", body: "Chi/Thu từ 90% tô cam, trên 100% tô đỏ. Còn lại âm và số dư âm có dấu ⚠. Thẻ còn dưới 20% hạn mức thì cam, âm thì đỏ." },
  { title: "Báo cáo", body: "Nút Báo cáo ở đầu trang. Chọn sổ Gia đình, Cá nhân, hoặc Tổng để xem cả hai sổ cộng lại. Theo tháng vẽ thu chi từng ngày. Theo khoảng vẽ từng tháng, chọn 3 tháng, 6 tháng, 12 tháng, cả năm, hoặc từ tháng đến tháng. Chuyển khoản không tính." },
  { title: "Xuất PDF", body: "Nút Xuất PDF ở đầu trang chọn sổ Gia đình, Cá nhân, hoặc Tổng để xuất cả hai sổ cộng lại, và chọn có in số dư hay không. Phần 1 là tổng hợp thu chi và đường so với 6 tháng trước. Phần 2 là chi tiết từng ngày." },
  { title: "Dữ liệu nằm trên máy này", body: "App không gửi số liệu đi đâu và không tự đồng bộ giữa các máy. Muốn chuyển máy: bấm Sao lưu, giữ file JSON, rồi Khôi phục trên máy kia." },
  { title: "Dữ liệu có thể mất", body: "Trên iPhone, Chrome, Safari và icon Màn hình chính là ba sổ khác nhau. Sổ nhập trong Chrome không hiện khi mở icon. Muốn đưa sang icon: trong Chrome bấm Sao lưu, mở icon, bấm Khôi phục. Sau đó chỉ nhập ở một chỗ. Tab Riêng tư, Zalo hoặc Facebook cũng là sổ khác." },
  { title: "Xem mã nguồn", body: "Nhấn Ctrl+Alt+T, hoặc chạm ba lần vào tiêu đề." },
];

type Dialog =
  | { kind: "msg"; text: string }
  | { kind: "yes"; text: string; onYes: () => void }
  | { kind: "ask"; title: string; onOk: (value: string) => void }
  | { kind: "accounts" }
  | { kind: "account"; id?: string }
  | { kind: "cats"; flow: Flow }
  | { kind: "budgets" }
  | { kind: "report" }
  | { kind: "pdf" }
  | { kind: "help" }
  | { kind: "source" };

const loaded = loadAppData();

export function App() {
  const [data, setData] = useState<AppData>(loaded.data);
  const dataRef = useRef(data);
  const [saveError, setSaveError] = useState<string | null>(loaded.error);
  const [month, setMonth] = useState(currentMonth);
  const [scope, setScope] = useState<LedgerScope>(readScope);
  const [hasUndo, setHasUndo] = useState(() => loadUndo() !== null);
  const [storageEnv] = useState(() => readStorageEnv());
  const storageWarning = storageNotice({ ...storageEnv, hasEntries: data.transactions.length > 0 });
  const [showTotals, setShowTotals] = useState(() => readFlag(SHOW_TOTALS_KEY));
  const [showBalances, setShowBalances] = useState(() => readFlag(SHOW_BALANCES_KEY));
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [type, setType] = useState<TxType>("x");
  const [rememberedType, setRememberedType] = useState<TxType>("x");
  const [rememberedAccount, setRememberedAccount] = useState("a1");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [category, setCategory] = useState("Ăn uống");
  const [sub, setSub] = useState("");
  const [accountId, setAccountId] = useState("a1");
  const [toAccountId, setToAccountId] = useState("a2");
  const [note, setNote] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taps = useRef<number[]>([]);
  const mirrorChecked = useRef(false);
  const saveErrorRef = useRef(saveError);
  saveErrorRef.current = saveError;

  function commit(next: AppData) {
    dataRef.current = next;
    setData(next);
    setSaveError(saveAppData(next));
  }

  function push(dialog: Dialog) {
    setDialogs((list) => [...list, dialog]);
  }

  function pop() {
    setDialogs((list) => list.slice(0, -1));
  }

  function apply(result: Result) {
    if (!result.ok) {
      push({ kind: "msg", text: result.error });
      return;
    }
    commit(result.data);
  }

  useEffect(() => {
    let cancel = false;
    void loadMirror().then((mirror) => {
      if (cancel) return;
      if (mirror && mirror.revision > currentRevision()) {
        rememberRevision(mirror.revision);
        commit(mirror.data);
      } else if (!saveErrorRef.current) {
        void mirrorCurrent(dataRef.current);
      }
      mirrorChecked.current = true;
    });
    const flush = () => {
      if (!mirrorChecked.current) return;
      saveAppData(dataRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    void navigator.storage?.persist?.();
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setDialogs((list) => [...list, { kind: "source" }]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancel = true;
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function chooseScope(next: LedgerScope) {
    setScope(next);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* Máy không cho ghi thì chỉ đổi trong phiên này. */
    }
    blank(rememberedType, rememberedAccount, dataRef.current, next);
  }

  function blank(nextType: TxType, nextAccount: string, book: AppData, nextScope: LedgerScope = scope) {
    setEditing(null);
    setType(nextType);
    setAmount("");
    setDate(todayISO());
    setNote("");
    const names = nextType === "p" ? [] : listOf(book, nextScope, nextType === "t" ? "income" : "expense").map((item) => item.name);
    setCategory(names[0] ?? "");
    setSub("");
    const account = book.accounts.some((item) => item.id === nextAccount) ? nextAccount : (book.accounts[0]?.id ?? "");
    setAccountId(account);
    setToAccountId((book.accounts.find((item) => item.kind === "cr") ?? book.accounts[0])?.id ?? "");
  }

  function chooseType(next: TxType) {
    setType(next);
    if (editing === null) setRememberedType(next);
    if (next === "p") return;
    const flow: Flow = next === "t" ? "income" : "expense";
    const names = listOf(dataRef.current, scope, flow).map((item) => item.name);
    const picked = names.includes(category) ? category : (names[0] ?? "");
    const parent = listOf(dataRef.current, scope, flow).find((item) => item.name === picked);
    setCategory(picked);
    setSub(parent?.subs.includes(sub) ? sub : "");
  }

  function beginEdit(tx: Transaction) {
    setEditing(tx.id);
    setType(tx.type);
    setAmount(String(tx.amount));
    setDate(tx.date);
    setCategory(tx.category);
    setSub(tx.sub ?? "");
    setAccountId(tx.accountId);
    setToAccountId(tx.toAccountId || (dataRef.current.accounts.find((item) => item.kind === "cr") ?? dataRef.current.accounts[0])?.id || "");
    setNote(tx.note ?? "");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSave() {
    const result = saveTransaction(dataRef.current, {
      id: editing ?? undefined,
      type,
      amountText: amount,
      date,
      category,
      sub,
      accountId,
      toAccountId,
      note,
      scope,
    });
    if (!result.ok) {
      push({ kind: "msg", text: result.error });
      return;
    }
    const nextType = editing === null ? type : rememberedType;
    setRememberedAccount(accountId);
    commit(result.data);
    setMonth(date.slice(0, 7));
    blank(nextType, accountId, result.data);
  }

  function move(id: number, direction: -1 | 1) {
    const current = dataRef.current;
    commit({ ...current, transactions: moveWithinDay(current.transactions, id, direction) });
  }

  function moveScope(id: number) {
    const nextScope: LedgerScope = scope === "family" ? "personal" : "family";
    const next = moveTransaction(dataRef.current, id, nextScope);
    commit(next);
    if (editing === id) blank(rememberedType, rememberedAccount, next, scope);
  }

  async function backup() {
    const payload = JSON.stringify(dataRef.current, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const filename = `thu-chi-backup-${todayISO()}.json`;
    const file = new File([blob], filename, { type: "application/json" });
    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file], title: "Sao lưu Thu Chi Gia Đình" });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        downloadBlob(blob, filename);
      }
    } else {
      downloadBlob(blob, filename);
    }
    commit({ ...dataRef.current, lastBackup: todayISO() });
  }

  async function onRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = normalize(JSON.parse(await file.text()) as unknown);
      if (!next) {
        push({ kind: "msg", text: "File không đúng định dạng sổ thu chi." });
        return;
      }
      push({
        kind: "yes",
        text: "Khôi phục sẽ ghi đè sổ hiện tại. Bản đang dùng được giữ lại để hoàn tác.",
        onYes: () => {
          saveUndo(dataRef.current);
          setHasUndo(true);
          commit(next);
          blank(rememberedType, rememberedAccount, next);
        },
      });
    } catch {
      push({ kind: "msg", text: "Không đọc được file." });
    }
  }

  async function exportPdf(includeBalances: boolean, picked: ReportScope) {
    pop();
    try {
      const { buildPdf } = await import("./pdf");
      const font = await loadFont();
      const blob = await buildPdf(dataRef.current, month, font, { includeBalances, scope: picked });
      const filename = `thu-chi-${picked === "family" ? "gia-dinh" : picked === "personal" ? "ca-nhan" : "tong"}-${month}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      if (canShareFile(file)) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      downloadBlob(blob, filename);
    } catch {
      push({ kind: "msg", text: "Không xuất được PDF." });
    }
  }

  function onTitle() {
    const now = Date.now();
    taps.current = taps.current.filter((time) => now - time < 600);
    taps.current.push(now);
    if (taps.current.length >= 3) {
      taps.current = [];
      push({ kind: "source" });
    }
  }

  const scopedTx = data.transactions.filter((tx) => tx.scope === scope);
  const totals = monthTotals(scopedTx, month);
  const snapshots = accountSnapshots(data);
  const spends = categorySpend(data, month, scope);
  const rows = screenOrder(scopedTx, month);
  const colors = allCategories(data, scope);
  const age = backupAgeDays(data.lastBackup, todayISO());
  const flow: Flow | null = type === "t" ? "income" : type === "x" ? "expense" : null;
  const parents = flow ? listOf(data, scope, flow) : [];
  const categoryOptions = parents.map((item) => item.name);
  if (category && flow && !categoryOptions.includes(category)) categoryOptions.push(category);
  const parent = parents.find((item) => item.name === category);
  const subOptions = [...(parent?.subs ?? [])];
  if (sub && !subOptions.includes(sub)) subOptions.push(sub);
  const accountLabel = type === "t" ? "Vào tài khoản" : type === "x" ? "Chi từ tài khoản" : "Từ tài khoản";

  return (
    <div className="page">
      <header>
        <div className="top">
          <h1 onClick={onTitle}>💰 Thu Chi Gia Đình</h1>
          <div>
            <button type="button" className="ib" onClick={() => push({ kind: "accounts" })}>🏦 Tài khoản</button>
            <button type="button" className="ib" onClick={() => push({ kind: "cats", flow: "expense" })}>⚙ Danh mục</button>
            <button type="button" className="ib" onClick={() => push({ kind: "budgets" })}>🎯 Ngân sách</button>
            <button type="button" className="ib" onClick={() => push({ kind: "help" })}>❓ Hướng dẫn</button>
          </div>
        </div>
        <div className="head-tools">
          <button type="button" onClick={() => void backup()}>Sao lưu</button>
          <button type="button" onClick={() => fileRef.current?.click()}>Khôi phục</button>
          <button type="button" onClick={() => push({ kind: "pdf" })}>Xuất PDF</button>
          <button type="button" onClick={() => push({ kind: "report" })}>Báo cáo</button>
          <input ref={fileRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => void onRestoreFile(event)} />
        </div>
        <div className="scope">
          <button type="button" className={scope === "family" ? "on" : ""} onClick={() => chooseScope("family")}>Gia đình</button>
          <button type="button" className={scope === "personal" ? "on" : ""} onClick={() => chooseScope("personal")}>Cá nhân</button>
        </div>
        <div className="status" role="status">{saveError ? `⚠ ${saveError}` : `☁ Đã lưu${data.lastBackup ? ` · sao lưu ${formatFullDay(data.lastBackup)}` : ""}`}</div>
        <div className="mn">
          <button type="button" aria-label="Tháng trước" onClick={() => setMonth((value) => shiftMonth(value, -1))}>◀</button>
          <b>{monthLabel(month)}</b>
          <button type="button" aria-label="Tháng sau" onClick={() => setMonth((value) => shiftMonth(value, 1))}>▶</button>
        </div>
      </header>
      <main>
        {storageWarning && <div className="banner keep">{storageWarning}</div>}
        {(age === null || age >= 30) && (
          <button type="button" className="banner" onClick={() => void backup()}>
            {age === null ? "Chưa sao lưu lần nào — Sao lưu ngay" : `Đã ${age} ngày chưa sao lưu — Sao lưu ngay`}
          </button>
        )}
        {hasUndo && (
          <div className="undo-bar">
            <span>Đã khôi phục. Có thể quay lại sổ trước đó.</span>
            <button type="button" onClick={() => {
              const previous = loadUndo();
              saveUndo(null);
              setHasUndo(false);
              if (previous) {
                commit(previous);
                blank(rememberedType, rememberedAccount, previous);
              }
            }}>Hoàn tác</button>
            <button type="button" onClick={() => { saveUndo(null); setHasUndo(false); }}>Giữ bản này</button>
          </div>
        )}
        <button type="button" className="peek" aria-expanded={showTotals} onClick={() => setShowTotals(toggleFlag(SHOW_TOTALS_KEY, showTotals))}>
          <span>Tổng thu chi · {SCOPE_LABEL[scope]}</span>
          <span>{showTotals ? "Ẩn" : "Xem"}</span>
        </button>
        {showTotals && (
          <div className="grid gap">
            <div className="c thu"><small>Tổng thu</small><div className="v">{formatVnd(totals.income)}</div></div>
            <div className="c chi"><small>Tổng chi</small><div className="v">{formatVnd(totals.expense)}</div></div>
            <div className={`c ${totals.left < 0 ? "bad" : "ok"}`}><small>Còn lại</small><div className="v">{totals.left < 0 ? "⚠ " : ""}{formatVnd(totals.left)}</div></div>
            <div className={`c ${toneClass(totals.tone)}`}><small>Chi / Thu</small><div className="v">{totals.ratioText}{totals.ratioNote}</div></div>
          </div>
        )}
        <button type="button" className="peek" aria-expanded={showBalances} onClick={() => setShowBalances(toggleFlag(SHOW_BALANCES_KEY, showBalances))}>
          <span>Số dư tài khoản</span>
          <span>{showBalances ? "Ẩn" : "Xem"}</span>
        </button>
        {showBalances && (
          <div className="grid gap">
            {snapshots.map((snapshot) => (
              <div key={snapshot.account.id} className={`c ${toneClass(snapshot.tone)}`}>
                <small>{KIND_ICON[snapshot.account.kind]} {snapshot.account.name}{snapshot.account.kind === "cr" ? " · khả dụng" : ""}</small>
                <div className="v">{primaryText(snapshot)}</div>
                {snapshot.debt !== null && (
                  <small>Dư nợ {formatVnd(snapshot.debt)}{snapshot.account.limit ? ` / ${formatVnd(snapshot.account.limit)}` : ""}</small>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="c fm gap" id="fm" ref={formRef}>
          <h3>{editing === null ? "Thêm giao dịch" : "Sửa giao dịch"}</h3>
          <div className="seg three">
            <button type="button" className={type === "t" ? "on t" : "t"} onClick={() => chooseType("t")}>Thu</button>
            <button type="button" className={type === "x" ? "on x" : "x"} onClick={() => chooseType("x")}>Chi</button>
            <button type="button" className={type === "p" ? "on p" : "p"} onClick={() => chooseType("p")}>Chuyển</button>
          </div>
          <div className="g2">
            <div>
              <label>Số tiền (vd: 50k, 1.5tr)</label>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            <div>
              <label>Ngày</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
          </div>
          {type !== "p" && (
            <div className="g2">
              <div>
                <label>Danh mục</label>
                <select value={category} onChange={(event) => {
                  const value = event.target.value;
                  if (value !== "__new__") {
                    setCategory(value);
                    setSub("");
                    return;
                  }
                  const currentFlow: Flow = type === "t" ? "income" : "expense";
                  push({
                    kind: "ask",
                    title: "Tên danh mục mới",
                    onOk: (name) => {
                      const trimmed = name.trim();
                      if (!trimmed) return;
                      const result = addCategory(dataRef.current, currentFlow, trimmed, scope);
                      if (!result.ok) {
                        push({ kind: "msg", text: result.error });
                        return;
                      }
                      commit(result.data);
                      setCategory(trimmed);
                      setSub("");
                    },
                  });
                }}>
                  {categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                  <option value="__new__">＋ Thêm danh mục mới…</option>
                </select>
              </div>
              <div>
                <label>Danh mục con</label>
                <select value={sub} onChange={(event) => {
                  const value = event.target.value;
                  if (value !== "__new__") {
                    setSub(value);
                    return;
                  }
                  const currentFlow: Flow = type === "t" ? "income" : "expense";
                  const parentName = category;
                  push({
                    kind: "ask",
                    title: "Tên danh mục con",
                    onOk: (name) => {
                      const trimmed = name.trim();
                      if (!trimmed) return;
                      const result = addSub(dataRef.current, currentFlow, parentName, trimmed, scope);
                      if (!result.ok) {
                        push({ kind: "msg", text: result.error });
                        return;
                      }
                      commit(result.data);
                      setSub(trimmed);
                    },
                  });
                }}>
                  <option value="">— không —</option>
                  {subOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                  <option value="__new__">＋ Thêm danh mục con…</option>
                </select>
              </div>
            </div>
          )}
          <div className="g2">
            <div>
              <label>{accountLabel}</label>
              <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            {type === "p" && (
              <div>
                <label>Đến tài khoản</label>
                <select value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
                  {data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <label>Ghi chú</label>
          <input value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="btns">
            <button type="button" className="b2" onClick={() => blank(rememberedType, rememberedAccount, dataRef.current)}>{editing === null ? "Làm mới" : "Hủy sửa"}</button>
            {editing !== null && (
              <button type="button" className="b3" onClick={() => {
                const id = editing;
                push({
                  kind: "yes",
                  text: "Xóa giao dịch này?",
                  onYes: () => {
                    const next = deleteTransaction(dataRef.current, id);
                    commit(next);
                    blank(rememberedType, rememberedAccount, next);
                  },
                });
              }}>Xóa</button>
            )}
            <button type="button" className="b1" onClick={onSave}>Lưu</button>
          </div>
        </div>
        <h2>Chi theo danh mục · {SCOPE_LABEL[scope]}</h2>
        <div className="list">
          {spends.length === 0 && <div className="empty">Chưa có khoản chi</div>}
          {spends.map((row) => (
            <div key={row.name} className={`cat ${row.tone === "bad" ? "ov" : ""}`}>
              <div className="h">
                <b>
                  <i className="dot" style={{ background: categoryColor(colors, row.name) }} />
                  {row.name}
                  {row.tag && <span className={`tag ${row.tag === "VƯỢT" ? "ov" : "w"}`}>{row.tag}</span>}
                </b>
                <span className="amt x">{formatVnd(row.total)}</span>
              </div>
              {row.caption && <small>{row.caption}</small>}
              <div className={`bar ${row.tone === "bad" ? "ov" : row.tone === "warn" ? "wr2" : ""}`}>
                <i style={{ width: `${Math.min(100, row.percent)}%` }} />
              </div>
              {row.subs.map((child) => (
                <div key={child.name} className="sc"><span>↳ {child.name}</span><span>{formatVnd(child.total)}</span></div>
              ))}
            </div>
          ))}
        </div>
        <h2>Giao dịch · {SCOPE_LABEL[scope]}</h2>
        <div className="list">
          {rows.length === 0 && <div className="empty">Chưa có giao dịch trong sổ {SCOPE_LABEL[scope].toLowerCase()}. Nhập ở form phía trên.</div>}
          {rows.map((tx) => (
            <div key={tx.id} className="row" style={{ borderLeft: `4px solid ${tx.type === "p" ? "var(--pri)" : categoryColor(colors, tx.category)}` }} onClick={() => beginEdit(tx)}>
              <div className="l">
                <b>{tx.category}{tx.sub ? ` › ${tx.sub}` : ""}</b>
                <small>
                  {formatDay(tx.date)} · {accountName(data, tx.accountId)}
                  {tx.type === "p" ? ` → ${accountName(data, tx.toAccountId)}` : ""}
                  {tx.note ? ` · ${tx.note}` : ""}
                </small>
                <button type="button" className="jump" onClick={(event) => { event.stopPropagation(); moveScope(tx.id); }}>
                  Chuyển sang {scope === "family" ? "Cá nhân" : "Gia đình"}
                </button>
              </div>
              <span className={`amt ${tx.type}`}>{tx.type === "t" ? "+" : tx.type === "p" ? "⇄ " : "−"}{formatVnd(tx.amount)}</span>
              <span className="mv">
                <button type="button" aria-label="Đưa lên" onClick={(event) => { event.stopPropagation(); move(tx.id, -1); }}>▲</button>
                <button type="button" aria-label="Đưa xuống" onClick={(event) => { event.stopPropagation(); move(tx.id, 1); }}>▼</button>
              </span>
            </div>
          ))}
        </div>
      </main>
      {dialogs.map((dialog, index) => (
        <Sheet key={index} onClose={pop}>
          {dialog.kind === "msg" && (
            <>
              <h3>{dialog.text}</h3>
              <div className="btns"><button type="button" className="b1" onClick={pop}>OK</button></div>
            </>
          )}
          {dialog.kind === "yes" && (
            <>
              <h3>{dialog.text}</h3>
              <div className="btns">
                <button type="button" className="b2" onClick={pop}>Không</button>
                <button type="button" className="b3" onClick={() => { pop(); dialog.onYes(); }}>Đồng ý</button>
              </div>
            </>
          )}
          {dialog.kind === "ask" && <AskDialog title={dialog.title} onCancel={pop} onOk={(value) => { pop(); dialog.onOk(value); }} />}
          {dialog.kind === "accounts" && (
            <AccountsSheet
              data={data}
              onClose={pop}
              onAdd={() => push({ kind: "account" })}
              onEdit={(id) => push({ kind: "account", id })}
            />
          )}
          {dialog.kind === "account" && (
            <AccountForm
              initial={data.accounts.find((account) => account.id === dialog.id)}
              onCancel={pop}
              onSave={(input) => {
                const result = saveAccount(dataRef.current, input);
                if (!result.ok) {
                  push({ kind: "msg", text: result.error });
                  return;
                }
                commit(result.data);
                pop();
              }}
              onDelete={dialog.id ? () => {
                const id = dialog.id;
                if (!id) return;
                const blocked = deleteAccount(dataRef.current, id);
                if (!blocked.ok) {
                  push({ kind: "msg", text: blocked.error });
                  return;
                }
                const name = dataRef.current.accounts.find((account) => account.id === id)?.name ?? "";
                push({
                  kind: "yes",
                  text: `Xóa tài khoản "${name}"?`,
                  onYes: () => {
                    const removed = deleteAccount(dataRef.current, id);
                    if (!removed.ok) {
                      push({ kind: "msg", text: removed.error });
                      return;
                    }
                    commit(removed.data);
                    pop();
                  },
                });
              } : undefined}
            />
          )}
          {dialog.kind === "cats" && (
            <CategorySheet
              data={data}
              scope={scope}
              flow={dialog.flow}
              onFlow={(next) => setDialogs((list) => list.map((item, itemIndex) => itemIndex === index && item.kind === "cats" ? { ...item, flow: next } : item))}
              onClose={pop}
              onApply={apply}
              onCommit={commit}
              onColor={(name, color) => commit(setCategoryColor(dataRef.current, dialog.flow, name, color, scope))}
              onAsk={(title, onOk) => push({ kind: "ask", title, onOk })}
              onYes={(text, onYes) => push({ kind: "yes", text, onYes })}
            />
          )}
          {dialog.kind === "budgets" && (
            <BudgetForm
              names={data.categories[scope].expense.map((item) => item.name)}
              budgets={data.budgets[scope]}
              onCancel={pop}
              onSave={(texts) => {
                const result = saveBudgets(dataRef.current, texts, scope);
                if (!result.ok) {
                  push({ kind: "msg", text: result.error });
                  return;
                }
                commit(result.data);
                pop();
              }}
            />
          )}
          {dialog.kind === "report" && <ReportSheet transactions={data.transactions} endMonth={month} today={todayISO()} initialScope={scope} onClose={pop} />}
          {dialog.kind === "pdf" && <PdfSheet month={month} initialScope={scope} onClose={pop} onExport={(includeBalances, picked) => void exportPdf(includeBalances, picked)} />}
          {dialog.kind === "help" && (
            <>
              <h3>❓ Hướng dẫn</h3>
              <div className="gd">
                {HELP.map((item) => <p key={item.title}>• <b>{item.title}</b>: {item.body}</p>)}
              </div>
              <div className="btns"><button type="button" className="b1" onClick={pop}>Đóng</button></div>
            </>
          )}
          {dialog.kind === "source" && (
            <>
              <h3>📄 Mã nguồn</h3>
              <pre>{SOURCE}</pre>
              <div className="btns"><button type="button" className="b1" onClick={pop}>Đóng</button></div>
            </>
          )}
        </Sheet>
      ))}
    </div>
  );
}

function PdfSheet({ month, initialScope, onClose, onExport }: { month: string; initialScope: LedgerScope; onClose: () => void; onExport: (includeBalances: boolean, scope: ReportScope) => void }) {
  const [picked, setPicked] = useState<ReportScope>(initialScope);
  const [balances, setBalances] = useState(false);
  return (
    <>
      <h3>Xuất PDF</h3>
      <small className="hint">Báo cáo {monthLabel(month)}. Phần 1 là tổng hợp thu chi, có đường so với 6 tháng trước. Phần 2 là chi tiết từng ngày.</small>
      <small className="hint">Sổ</small>
      <div className="seg three">
        <button type="button" className={picked === "family" ? "on p" : ""} onClick={() => setPicked("family")}>{REPORT_SCOPE_LABEL.family}</button>
        <button type="button" className={picked === "personal" ? "on p" : ""} onClick={() => setPicked("personal")}>{REPORT_SCOPE_LABEL.personal}</button>
        <button type="button" className={picked === "all" ? "on p" : ""} onClick={() => setPicked("all")}>{REPORT_SCOPE_LABEL.all}</button>
      </div>
      <small className="hint">Số dư tài khoản</small>
      <div className="seg">
        <button type="button" className={balances ? "" : "on p"} onClick={() => setBalances(false)}>Không xuất</button>
        <button type="button" className={balances ? "on p" : ""} onClick={() => setBalances(true)}>Xuất số dư</button>
      </div>
      <div className="btns">
        <button type="button" className="b2" onClick={onClose}>Hủy</button>
        <button type="button" className="b1" onClick={() => onExport(balances, picked)}>Xuất</button>
      </div>
    </>
  );
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="ov-bg" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sh" role="dialog">{children}</div>
    </div>
  );
}

function AskDialog({ title, onCancel, onOk }: { title: string; onCancel: () => void; onOk: (value: string) => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <>
      <h3>{title}</h3>
      <input ref={ref} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onOk(value); }} />
      <div className="btns">
        <button type="button" className="b2" onClick={onCancel}>Hủy</button>
        <button type="button" className="b1" onClick={() => onOk(value)}>OK</button>
      </div>
    </>
  );
}

function AccountsSheet({ data, onClose, onAdd, onEdit }: { data: AppData; onClose: () => void; onAdd: () => void; onEdit: (id: string) => void }) {
  const snapshots = accountSnapshots(data);
  return (
    <>
      <h3>🏦 Tài khoản / nguồn tiền</h3>
      <div className="list">
        {snapshots.length === 0 && <div className="empty">Chưa có tài khoản</div>}
        {snapshots.map((snapshot) => (
          <button type="button" key={snapshot.account.id} className="row" onClick={() => onEdit(snapshot.account.id)}>
            <div className="l">
              <b>{KIND_ICON[snapshot.account.kind]} {snapshot.account.name}</b>
              <small>{snapshot.account.kind === "cr" ? "Khả dụng " : "Số dư "}{snapshot.primary || formatVnd(snapshot.available)}</small>
            </div>
            <span>✏</span>
          </button>
        ))}
      </div>
      <div className="btns">
        <button type="button" className="b2" onClick={onClose}>Đóng</button>
        <button type="button" className="b1" onClick={onAdd}>＋ Tài khoản</button>
      </div>
    </>
  );
}

function AccountForm({ initial, onCancel, onSave, onDelete }: { initial?: Account; onCancel: () => void; onSave: (input: AccountInput) => void; onDelete?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "bank");
  const [opening, setOpening] = useState(initial?.opening ? String(initial.opening) : "");
  const [limit, setLimit] = useState(initial?.limit ? String(initial.limit) : "");
  return (
    <>
      <h3>{initial ? "Sửa tài khoản" : "Thêm tài khoản"}</h3>
      <label>Tên</label>
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <label>Loại</label>
      <select value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
        <option value="bank">🏦 Ngân hàng</option>
        <option value="ew">📱 Ví điện tử</option>
        <option value="cash">💵 Tiền mặt</option>
        <option value="cr">💳 Thẻ tín dụng</option>
      </select>
      <label>{kind === "cr" ? "Dư nợ ban đầu (đã chi, chưa trả)" : "Số dư ban đầu"}</label>
      <input inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} />
      {kind === "cr" && (
        <>
          <label>Hạn mức</label>
          <input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} />
        </>
      )}
      <div className="btns">
        <button type="button" className="b2" onClick={onCancel}>Hủy</button>
        {onDelete && <button type="button" className="b3" onClick={onDelete}>Xóa</button>}
        <button type="button" className="b1" onClick={() => onSave({ id: initial?.id, name, kind, openingText: opening, limitText: limit })}>Lưu</button>
      </div>
    </>
  );
}

function CategorySheet({ data, scope, flow, onFlow, onClose, onApply, onCommit, onColor, onAsk, onYes }: {
  data: AppData;
  scope: LedgerScope;
  flow: Flow;
  onFlow: (flow: Flow) => void;
  onClose: () => void;
  onApply: (result: Result) => void;
  onCommit: (data: AppData) => void;
  onColor: (name: string, color: string) => void;
  onAsk: (title: string, onOk: (value: string) => void) => void;
  onYes: (text: string, onYes: () => void) => void;
}) {
  const categories = listOf(data, scope, flow);
  return (
    <>
      <h3>⚙ Danh mục · {SCOPE_LABEL[scope]}</h3>
      <div className="seg">
        <button type="button" className={flow === "income" ? "on t" : "t"} onClick={() => onFlow("income")}>Thu</button>
        <button type="button" className={flow === "expense" ? "on x" : "x"} onClick={() => onFlow("expense")}>Chi</button>
      </div>
      <div className="list gap">
        {categories.length === 0 && <div className="empty">Chưa có danh mục</div>}
        {categories.map((item) => (
          <div key={item.name} className="cat">
            <div className="h">
              <b>
                <input
                  className="cc"
                  type="color"
                  aria-label={`Màu ${item.name}`}
                  value={item.color || categoryColor(categories, item.name)}
                  onChange={(event) => onColor(item.name, event.target.value)}
                />
                {" "}{item.name}
              </b>
              <span className="actions">
                <button type="button" className="sm" onClick={() => onAsk(`Tên danh mục con của "${item.name}"`, (name) => { if (name.trim()) onApply(addSub(data, flow, item.name, name, scope)); })}>＋ con</button>
                <button type="button" className="sm" onClick={() => onAsk("Đổi tên danh mục", (name) => { if (name.trim()) onApply(renameCategory(data, flow, item.name, name, scope)); })}>✏</button>
                <button type="button" className="sm" onClick={() => onYes(`Xóa danh mục "${item.name}"? Các giao dịch cũ vẫn giữ nguyên tên này.`, () => onCommit(deleteCategory(data, flow, item.name, scope)))}>🗑</button>
              </span>
            </div>
            {item.subs.map((child) => (
              <div key={child} className="sc">
                <span>↳ {child}</span>
                <span className="actions">
                  <button type="button" className="sm" onClick={() => onAsk("Đổi tên danh mục con", (name) => { if (name.trim()) onApply(renameSub(data, flow, item.name, child, name, scope)); })}>✏</button>
                  <button type="button" className="sm" onClick={() => onYes(`Xóa danh mục con "${child}"?`, () => onCommit(deleteSub(data, flow, item.name, child, scope)))}>🗑</button>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="btns">
        <button type="button" className="b2" onClick={onClose}>Đóng</button>
        <button type="button" className="b1" onClick={() => onAsk("Tên danh mục mới", (name) => { if (name.trim()) onApply(addCategory(data, flow, name, scope)); })}>＋ Danh mục</button>
      </div>
    </>
  );
}

function BudgetForm({ names, budgets, onCancel, onSave }: { names: string[]; budgets: Record<string, number>; onCancel: () => void; onSave: (texts: Record<string, string>) => void }) {
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(names.map((name) => [name, budgets[name] ? String(budgets[name]) : ""])));
  return (
    <>
      <h3>🎯 Ngân sách tháng theo danh mục</h3>
      <small className="hint">Để trống hoặc 0 = không giới hạn. Vượt ngân sách sẽ bị tô đỏ.</small>
      {names.map((name) => (
        <div key={name}>
          <label>{name}</label>
          <input inputMode="decimal" value={texts[name] ?? ""} onChange={(event) => setTexts((current) => ({ ...current, [name]: event.target.value }))} />
        </div>
      ))}
      <div className="btns">
        <button type="button" className="b2" onClick={onCancel}>Đóng</button>
        <button type="button" className="b1" onClick={() => onSave(texts)}>Lưu</button>
      </div>
    </>
  );
}

const SHOW_TOTALS_KEY = "tcgd_show_totals";
const SHOW_BALANCES_KEY = "tcgd_show_balances";
const SCOPE_KEY = "tcgd_scope";

function readScope(): LedgerScope {
  try {
    return localStorage.getItem(SCOPE_KEY) === "personal" ? "personal" : "family";
  } catch {
    return "family";
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function toggleFlag(key: string, current: boolean): boolean {
  const next = !current;
  try {
    localStorage.setItem(key, next ? "1" : "0");
  } catch {
    // Máy không cho ghi thì vẫn đổi trên màn hình lần này.
  }
  return next;
}

function readStorageEnv(): Omit<Parameters<typeof storageNotice>[0], "hasEntries"> {
  let canWrite = true;
  try {
    localStorage.setItem("tcgd_probe", "1");
    localStorage.removeItem("tcgd_probe");
  } catch {
    canWrite = false;
  }
  const agent = navigator.userAgent;
  return {
    canWrite,
    inApp: /Zalo|FBAN|FBAV|Instagram|Line\//.test(agent),
    ios: /iPhone|iPad|iPod/.test(agent),
    chrome: /CriOS/.test(agent),
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

function toneClass(tone: Tone): string {
  if (tone === "bad") return "bad";
  if (tone === "warn") return "wr";
  if (tone === "ok") return "ok";
  return "";
}

function primaryText(snapshot: AccountSnapshot): string {
  if (snapshot.primary) return snapshot.primary;
  return `${snapshot.showWarning ? "⚠ " : ""}${formatVnd(snapshot.available)}`;
}

function accountName(data: AppData, id: string | undefined): string {
  return data.accounts.find((account) => account.id === id)?.name ?? "?";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function canShareFile(file: File): boolean {
  try {
    return !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

let fontTask: Promise<string> | null = null;

function loadFont(): Promise<string> {
  fontTask ??= fetch(fontUrl)
    .then((response) => {
      if (!response.ok) throw new Error("font");
      return response.arrayBuffer();
    })
    .then((buffer) => bytesToBase64(new Uint8Array(buffer)))
    .catch((error: unknown) => {
      fontTask = null;
      throw error;
    });
  return fontTask;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
