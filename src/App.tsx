import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  accountSnapshots,
  allCategories,
  backupAgeDays,
  categoryColor,
  categorySpend,
  groupByWeek,
  monthTotals,
  moveWithinDay,
  recentAmounts,
  type AccountSnapshot,
} from "./calc";
import fontUrl from "./fonts/Roboto-Regular.ttf?url";
import { currentMonth, editAmount, formatAmountTyping, formatDateTime, formatDay, formatFullDay, formatSyncTime, formatVnd, monthLabel, parseAmount, shiftMonth, todayISO } from "./money";
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
import { cloudConfig, currentEmail, pullBook, pushBook, readDirty, readStamp, signIn, signOut, signUp, writeDirty, writeStamp } from "./cloud";
import { cloudStatus, planSync } from "./cloudSync";
import { freshData } from "./defaults";
import { normalize } from "./migrate";
import { ReportSheet } from "./report";
import { SOURCE } from "./source";
import { storageNotice } from "./browserNotice";
import { currentRevision, loadAppData, loadMirror, loadUndo, mirrorCurrent, rememberRevision, saveAppData, saveUndo } from "./storage";
import { REPORT_SCOPE_LABEL, SCOPE_LABEL, type Account, type AccountKind, type AppData, type Flow, type LedgerScope, type ReportScope, type Tone, type Transaction, type TxType } from "./types";

const KIND_ICON: Record<AccountKind, string> = { bank: "🏦", ew: "📱", cash: "💵", cr: "💳" };
/** Lúc build (Actions build khi đăng lên Pages), để biết trang đang mở là bản mới hay bản cũ còn kẹt trong cache. */
const BUILD_TIME = __BUILD_TIME__;

const HELP: { title: string; body: string }[] = [
  { title: "Hai sổ", body: "Nút Gia đình và Cá nhân nằm ở cuối màn hình và đi theo khi cuộn. Gia đình là nền sáng, Cá nhân là nền tối. Mỗi sổ có danh mục cha, danh mục con, ngân sách và giao dịch riêng. Số dư tài khoản là số chung của cả hai sổ." },
  { title: "Nhập liệu ngay trên trang chủ", body: "Chọn sổ Gia đình hoặc Cá nhân, rồi chọn Thu, Chi hoặc Chuyển. Chọn danh mục và tài khoản trước. Số tiền ở cuối, tự có dấu chấm phần nghìn. Các số đã nhập của danh mục đó hiện phía trên ô tiền, bấm để điền lại. Vẫn gõ được 50k hoặc 1,5tr." },
  { title: "Sửa, xóa, sắp xếp", body: "Giao dịch của tuần này hiện ngay. Các tuần khác chỉ còn một dòng tổng thu và tổng chi, bấm Xem để mở. Chạm một giao dịch để đưa lên form. ▲ ▼ đổi chỗ với giao dịch liền kề trong cùng ngày. Nút Chuyển sang Cá nhân hoặc Gia đình đưa khoản đó sang sổ kia, kể cả khoản đã nhập từ trước." },
  { title: "Chuyển tháng", body: "Nút ◀ ▶ đổi tháng đang xem. Số dư tài khoản là số đến hiện tại, không phụ thuộc tháng." },
  { title: "Tổng thu chi và số dư", body: "Mở Menu rồi chọn Tổng thu chi hoặc Số dư tài khoản. Tổng thu chi theo tháng đang xem và sổ đang chọn. Số dư tài khoản là số đến hiện tại, dùng chung cho cả hai sổ." },
  { title: "Danh mục", body: "Mỗi sổ có danh mục riêng. Thêm, đổi tên, đổi màu, xóa danh mục cha và danh mục con của sổ đang chọn. Đổi tên cập nhật giao dịch cũ và ngân sách của sổ đó. Xóa danh mục không xóa giao dịch cũ." },
  { title: "Tài khoản", body: "Ngân hàng, ví điện tử, tiền mặt và thẻ tín dụng. Thẻ nhập dư nợ ban đầu và hạn mức. Khả dụng = hạn mức − dư nợ, không cộng vào số dư các tài khoản khác. Tài khoản đã có giao dịch thì không xóa được." },
  { title: "Chuyển khoản", body: "Dùng để trả thẻ hoặc chuyển giữa các tài khoản. Không tính là thu hay chi." },
  { title: "Ngân sách", body: "Hạn mức chi mỗi tháng cho từng danh mục cha của sổ đang chọn. Dưới 80% bình thường, từ 80% đến 100% là Sát mức (cam), trên 100% là VƯỢT (đỏ)." },
  { title: "Cảnh báo màu", body: "Chi/Thu từ 90% tô cam, trên 100% tô đỏ. Còn lại âm và số dư âm có dấu ⚠. Thẻ còn dưới 20% hạn mức thì cam, âm thì đỏ." },
  { title: "Báo cáo", body: "Mở Menu rồi chọn Báo cáo. Chọn sổ Gia đình, Cá nhân, hoặc Tổng để xem cả hai sổ cộng lại. Theo tháng vẽ thu chi từng ngày. Theo khoảng vẽ từng tháng, chọn 3 tháng, 6 tháng, 12 tháng, cả năm, hoặc từ tháng đến tháng. Chuyển khoản không tính." },
  { title: "Xuất PDF", body: "Mở Menu rồi chọn Xuất PDF. Chọn sổ Gia đình, Cá nhân, hoặc Tổng để xuất cả hai sổ cộng lại, và chọn có in số dư hay không. Phần 1 là tổng hợp thu chi và đường so với 6 tháng trước. Phần 2 là chi tiết từng ngày." },
  { title: "Dữ liệu trên Supabase", body: "Sổ được lưu trên Supabase. Icon mây ở đầu trang: mây gạch chéo là mất kết nối, mây thường là đang nối. Dòng chữ bên cạnh cho biết lần đồng bộ gần nhất. Mất mạng thì máy vẫn giữ sổ và đẩy lên khi có mạng lại. Mở Menu rồi chọn Mây để đăng nhập. Cùng email trên điện thoại khác thì dùng chung một sổ." },
  { title: "Dữ liệu nằm trên máy này", body: "Khi chưa đăng nhập Mây, app không gửi số liệu đi đâu. Vẫn có thể mở Menu, chọn Sao lưu ra file JSON rồi Khôi phục trên máy kia." },
  { title: "Dữ liệu có thể mất", body: "Trên iPhone, Chrome, Safari và icon Màn hình chính là ba sổ khác nhau. Sổ nhập trong Chrome không hiện khi mở icon. Muốn đưa sang icon: trong Chrome mở Menu, bấm Sao lưu, mở icon, mở Menu, bấm Khôi phục. Sau đó chỉ nhập ở một chỗ. Tab Riêng tư, Zalo hoặc Facebook cũng là sổ khác." },
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
  | { kind: "menu" }
  | { kind: "totals" }
  | { kind: "balances" }
  | { kind: "source" }
  | { kind: "cloud" }
  | { kind: "cloud-pick"; remote: AppData; updatedAt: string };

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
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [catsOpen, setCatsOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [type, setType] = useState<TxType>("x");
  const [rememberedType, setRememberedType] = useState<TxType>("x");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO);
  const [category, setCategory] = useState("Ăn uống");
  const [sub, setSub] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [note, setNote] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taps = useRef<number[]>([]);
  const mirrorChecked = useRef(false);
  const cloudReady = useRef(false);
  const uploadGen = useRef(0);
  const saveErrorRef = useRef(saveError);
  saveErrorRef.current = saveError;
  const [cloudEmail, setCloudEmail] = useState<string | null>(null);
  const [cloudOnline, setCloudOnline] = useState(() => navigator.onLine);
  const [cloudSyncing, setCloudSyncing] = useState(() => cloudConfig() !== null);
  const [cloudFailed, setCloudFailed] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(() => readStamp());
  const cloudBusy = useRef(false);

  function commit(next: AppData) {
    dataRef.current = next;
    setData(next);
    setSaveError(saveAppData(next));
    writeDirty(true);
    if (cloudReady.current) void uploadCurrent();
  }

  function adoptRemote(book: AppData, updatedAt: string) {
    dataRef.current = book;
    setData(book);
    setSaveError(saveAppData(book));
    writeStamp(updatedAt);
    writeDirty(false);
    setSyncedAt(updatedAt);
    setCloudFailed(false);
  }

  function markCloudDown() {
    setCloudFailed(true);
    setCloudSyncing(false);
  }

  async function uploadCurrent(quiet = false): Promise<string | null> {
    if (!cloudConfig() || !(await currentEmail())) return null;
    if (!navigator.onLine) {
      markCloudDown();
      return "Mất kết nối Supabase.";
    }
    if (!quiet) setCloudSyncing(true);
    const gen = ++uploadGen.current;
    const snapshot = dataRef.current;
    let result: Awaited<ReturnType<typeof pushBook>>;
    try {
      result = await pushBook(snapshot);
    } catch {
      if (gen !== uploadGen.current) return null;
      markCloudDown();
      return "Mất kết nối Supabase.";
    }
    if (gen !== uploadGen.current) return null;
    if (!quiet) setCloudSyncing(false);
    if (!result.ok) {
      markCloudDown();
      return result.error;
    }
    writeStamp(result.updatedAt);
    setSyncedAt(result.updatedAt);
    setCloudFailed(false);
    if (dataRef.current === snapshot) writeDirty(false);
    return null;
  }

  async function syncFromCloud(quiet = false): Promise<string | null> {
    if (cloudBusy.current) return null;
    if (!cloudConfig()) {
      setCloudSyncing(false);
      return null;
    }
    const email = await currentEmail();
    setCloudEmail(email);
    if (!email) {
      setCloudSyncing(false);
      return null;
    }
    if (!navigator.onLine) {
      markCloudDown();
      return "Mất kết nối Supabase.";
    }
    cloudBusy.current = true;
    if (!quiet) setCloudSyncing(true);
    try {
      const pulled = await pullBook();
      if (!pulled.ok) {
        markCloudDown();
        return pulled.error;
      }
      const remote = pulled.remote;
      const action = planSync({
        localCount: dataRef.current.transactions.length,
        remote: remote ? { updatedAt: remote.updatedAt, count: remote.book.transactions.length } : null,
        syncedAt: readStamp(),
        dirty: readDirty(),
      });
      if (action === "download" && remote) adoptRemote(remote.book, remote.updatedAt);
      if (action === "upload") {
        const error = await uploadCurrent(quiet);
        if (error) return error;
        if (readDirty()) return uploadCurrent(quiet);
      }
      if (action === "ask" && remote) {
        setDialogs((list) => (list.some((item) => item.kind === "cloud-pick") ? list : [...list, { kind: "cloud-pick", remote: remote.book, updatedAt: remote.updatedAt }]));
      }
      if (action !== "upload") {
        setCloudFailed(false);
        setSyncedAt(readStamp());
      }
      return null;
    } catch {
      markCloudDown();
      return "Mất kết nối Supabase.";
    } finally {
      cloudBusy.current = false;
      if (!quiet) setCloudSyncing(false);
    }
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
    void loadMirror().then(async (mirror) => {
      if (cancel) return;
      if (mirror && mirror.revision > currentRevision()) {
        rememberRevision(mirror.revision);
        commit(mirror.data);
      } else if (!saveErrorRef.current) {
        void mirrorCurrent(dataRef.current);
      }
      mirrorChecked.current = true;
      const email = await currentEmail();
      if (cancel) return;
      setCloudEmail(email);
      if (email) await syncFromCloud();
      else setCloudSyncing(false);
      cloudReady.current = true;
      if (readDirty() && email) await uploadCurrent();
    });
    const flush = () => {
      if (!mirrorChecked.current) return;
      saveAppData(dataRef.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
      else void syncFromCloud(true);
    };
    const onOnline = () => {
      setCloudOnline(true);
      void syncFromCloud();
    };
    const onOffline = () => setCloudOnline(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void syncFromCloud(true);
    }, 30000);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
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
      window.clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
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
    blank(rememberedType, dataRef.current, next);
  }

  /** Nguồn tiền không có giá trị mặc định: bắt chọn lại mỗi lần để tránh lỡ tay chọn nhầm tài khoản. */
  function blank(nextType: TxType, book: AppData, nextScope: LedgerScope = scope) {
    setEditing(null);
    setType(nextType);
    setAmount("");
    setDate(todayISO());
    setNote("");
    const names = nextType === "p" ? [] : listOf(book, nextScope, nextType === "t" ? "income" : "expense").map((item) => item.name);
    setCategory(names[0] ?? "");
    setSub("");
    setAccountId("");
    setToAccountId("");
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
    setAmount(formatAmountTyping(String(tx.amount)));
    setDate(tx.date);
    setCategory(tx.category);
    setSub(tx.sub ?? "");
    setAccountId(tx.accountId);
    setToAccountId(tx.toAccountId || "");
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
    commit(result.data);
    setMonth(date.slice(0, 7));
    blank(nextType, result.data);
  }

  function move(id: number, direction: -1 | 1) {
    const current = dataRef.current;
    commit({ ...current, transactions: moveWithinDay(current.transactions, id, direction) });
  }

  function moveScope(id: number) {
    const nextScope: LedgerScope = scope === "family" ? "personal" : "family";
    const next = moveTransaction(dataRef.current, id, nextScope);
    commit(next);
    if (editing === id) blank(rememberedType, next, scope);
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
          blank(rememberedType, next);
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
  const weeks = groupByWeek(scopedTx, month, todayISO());
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
  const suggestions = recentAmounts(data.transactions, { scope, type, category, sub });
  const typedAmount = parseAmount(amount);
  const cloudLine = cloudStatus({
    configured: cloudConfig() !== null,
    signedIn: cloudEmail !== null,
    online: cloudOnline,
    syncing: cloudSyncing,
    failed: cloudFailed,
    syncedLabel: syncedAt ? formatSyncTime(syncedAt) : null,
  });

  function onCloudLine() {
    if (!cloudConfig() || !cloudEmail) {
      push({ kind: "cloud" });
      return;
    }
    void syncFromCloud();
  }

  return (
    <div className={`page ${scope}`}>
      <header>
        <div className="top">
          <h1 onClick={onTitle}>💰 Thu Chi Gia Đình</h1>
          <button type="button" className="menu-btn" aria-haspopup="dialog" onClick={() => push({ kind: "menu" })}>☰ Menu</button>
        </div>
        <input ref={fileRef} className="hidden" type="file" accept="application/json,.json" onChange={(event) => void onRestoreFile(event)} />
        <button type="button" className={`cloud-line ${cloudLine.mode}`} onClick={onCloudLine}>
          <CloudMark mode={cloudLine.mode} />
          <span className="cloud-copy">
            <strong>{cloudLine.title}</strong>
            {cloudLine.detail && <small>{cloudLine.detail}</small>}
          </span>
        </button>
        <div className="status" role="status">{saveError ? `⚠ ${saveError}` : `Đã lưu trên máy${data.lastBackup ? ` · sao lưu ${formatFullDay(data.lastBackup)}` : ""}`}</div>
        <div className="build-time">Cập nhật lúc: {formatDateTime(BUILD_TIME)}</div>
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
                blank(rememberedType, previous);
              }
            }}>Hoàn tác</button>
            <button type="button" onClick={() => { saveUndo(null); setHasUndo(false); }}>Giữ bản này</button>
          </div>
        )}
        <div className="c fm gap" id="fm" ref={formRef}>
          <h3>{editing === null ? "Thêm giao dịch" : "Sửa giao dịch"}</h3>
          <div className="seg three">
            <button type="button" className={type === "t" ? "on t" : "t"} onClick={() => chooseType("t")}>Thu</button>
            <button type="button" className={type === "x" ? "on x" : "x"} onClick={() => chooseType("x")}>Chi</button>
            <button type="button" className={type === "p" ? "on p" : "p"} onClick={() => chooseType("p")}>Chuyển</button>
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
                <option value="">— Chọn tài khoản —</option>
                {data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            {type === "p" ? (
              <div>
                <label>Đến tài khoản</label>
                <select value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
                  <option value="">— Chọn tài khoản —</option>
                  {data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label>Ngày</label>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
            )}
          </div>
          {type === "p" && (
            <>
              <label>Ngày</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </>
          )}
          <label>Ghi chú</label>
          <input value={note} onChange={(event) => setNote(event.target.value)} />
          <label htmlFor="amount">Số tiền</label>
          {suggestions.length > 0 && (
            <div className="amt-picks" aria-label="Số đã nhập">
              {suggestions.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={typedAmount === value ? "on" : ""}
                  onClick={() => setAmount(formatAmountTyping(String(value)))}
                >
                  {formatVnd(value)}
                </button>
              ))}
            </div>
          )}
          <MoneyField id="amount" value={amount} onChange={setAmount} />
          <div className="btns">
            <button type="button" className="b2" onClick={() => blank(rememberedType, dataRef.current)}>{editing === null ? "Làm mới" : "Hủy sửa"}</button>
            {editing !== null && (
              <button type="button" className="b3" onClick={() => {
                const id = editing;
                push({
                  kind: "yes",
                  text: "Xóa giao dịch này?",
                  onYes: () => {
                    const next = deleteTransaction(dataRef.current, id);
                    commit(next);
                    blank(rememberedType, next);
                  },
                });
              }}>Xóa</button>
            )}
            <button type="button" className="b1" onClick={onSave}>Lưu</button>
          </div>
        </div>
        <Fold
          label="Chi tiết theo mục"
          income={totals.income}
          expense={totals.expense}
          open={catsOpen}
          onToggle={() => setCatsOpen((open) => !open)}
        >
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
        </Fold>
        <h2>Giao dịch · {SCOPE_LABEL[scope]}</h2>
        {weeks.buckets.length === 0 && <div className="list"><div className="empty">Chưa có giao dịch trong sổ {SCOPE_LABEL[scope].toLowerCase()}. Nhập ở form phía trên.</div></div>}
        {weeks.buckets.map((bucket) => {
          const open = weekOpen[bucket.start] ?? bucket.start === weeks.currentStart;
          const label = bucket.start === weeks.currentStart ? "Tuần này" : `${formatDay(bucket.start)}–${formatDay(bucket.end)}`;
          return (
            <Fold
              key={bucket.start}
              label={label}
              income={bucket.income}
              expense={bucket.expense}
              open={open}
              onToggle={() => setWeekOpen((current) => ({ ...current, [bucket.start]: !open }))}
            >
              <div className="list">
                {bucket.transactions.length === 0 && <div className="empty">Chưa có giao dịch trong tuần này.</div>}
                {bucket.transactions.map((tx) => (
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
            </Fold>
          );
        })}
      </main>
      <div className="scope-bar">
        <button type="button" className={scope === "family" ? "on" : ""} onClick={() => chooseScope("family")}>Gia đình</button>
        <button type="button" className={scope === "personal" ? "on" : ""} onClick={() => chooseScope("personal")}>Cá nhân</button>
      </div>
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
          {dialog.kind === "totals" && (
            <>
              <h3>Tổng thu chi · {SCOPE_LABEL[scope]}</h3>
              <small className="hint">{monthLabel(month)}</small>
              <div className="grid">
                <div className="c thu"><small>Tổng thu</small><div className="v">{formatVnd(totals.income)}</div></div>
                <div className="c chi"><small>Tổng chi</small><div className="v">{formatVnd(totals.expense)}</div></div>
                <div className={`c ${totals.left < 0 ? "bad" : "ok"}`}><small>Còn lại</small><div className="v">{totals.left < 0 ? "⚠ " : ""}{formatVnd(totals.left)}</div></div>
                <div className={`c ${toneClass(totals.tone)}`}><small>Chi / Thu</small><div className="v">{totals.ratioText}{totals.ratioNote}</div></div>
              </div>
              <div className="btns"><button type="button" className="b1" onClick={pop}>Đóng</button></div>
            </>
          )}
          {dialog.kind === "balances" && (
            <>
              <h3>Số dư tài khoản</h3>
              <small className="hint">Số đến hiện tại, dùng chung cho cả hai sổ.</small>
              {snapshots.length === 0 && <p>Chưa có tài khoản.</p>}
              <div className="grid">
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
              <div className="btns"><button type="button" className="b1" onClick={pop}>Đóng</button></div>
            </>
          )}
          {dialog.kind === "menu" && (
            <MenuSheet
              onClose={pop}
              onPick={(next) => { pop(); push(next); }}
              onBackup={() => { pop(); void backup(); }}
              onRestore={() => { fileRef.current?.click(); pop(); }}
            />
          )}
          {dialog.kind === "help" && (
            <>
              <h3>❓ Hướng dẫn</h3>
              <div className="gd">
                {HELP.map((item) => <p key={item.title}>• <b>{item.title}</b>: {item.body}</p>)}
              </div>
              <div className="btns"><button type="button" className="b1" onClick={pop}>Đóng</button></div>
            </>
          )}
          {dialog.kind === "cloud" && (
            <CloudSheet
              email={cloudEmail}
              onClose={pop}
              onSignedIn={() => {
                void (async () => {
                  setCloudEmail(await currentEmail());
                  pop();
                  cloudReady.current = true;
                  const error = await syncFromCloud();
                  if (error) push({ kind: "msg", text: error });
                })();
              }}
              onSignedOut={() => {
                setCloudEmail(null);
                setSyncedAt(null);
                setCloudFailed(false);
                setCloudSyncing(false);
                saveUndo(null);
                setHasUndo(false);
                const next = freshData();
                commit(next);
                blank(rememberedType, next);
                pop();
              }}
            />
          )}
          {dialog.kind === "cloud-pick" && (
            <>
              <h3>Hai sổ khác nhau</h3>
              <p>Máy này có {data.transactions.length} giao dịch. Mây có {dialog.remote.transactions.length} giao dịch. Chọn bản muốn giữ.</p>
              <div className="btns">
                <button type="button" className="b2" onClick={() => { adoptRemote(dialog.remote, dialog.updatedAt); pop(); }}>Dùng sổ trên mây</button>
                <button type="button" className="b1" onClick={() => { pop(); void uploadCurrent().then((error) => { if (error) push({ kind: "msg", text: error }); }); }}>Đưa sổ máy này lên mây</button>
              </div>
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

function Fold({ label, income, expense, open, onToggle, children }: {
  label: string;
  income: number;
  expense: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={open ? "fold open" : "fold"}>
      <button type="button" className="sum-line" aria-expanded={open} onClick={onToggle}>
        <span className="sum-label">{label}</span>
        <span className="sum-amts">
          <span className="amt t">+{formatVnd(income)}</span>
          <span className="amt x">−{formatVnd(expense)}</span>
        </span>
        <span className="sum-act">{open ? "Ẩn" : "Xem"}</span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </div>
  );
}

function MenuSheet({ onClose, onPick, onBackup, onRestore }: {
  onClose: () => void;
  onPick: (dialog: Dialog) => void;
  onBackup: () => void;
  onRestore: () => void;
}) {
  return (
    <>
      <h3>Menu</h3>
      <p className="menu-label">Số liệu</p>
      <div className="menu-list">
        <button type="button" onClick={() => onPick({ kind: "totals" })}><span aria-hidden="true">💵</span> Tổng thu chi</button>
        <button type="button" onClick={() => onPick({ kind: "balances" })}><span aria-hidden="true">💳</span> Số dư tài khoản</button>
      </div>
      <p className="menu-label">Sổ</p>
      <div className="menu-list">
        <button type="button" onClick={() => onPick({ kind: "accounts" })}><span aria-hidden="true">🏦</span> Tài khoản</button>
        <button type="button" onClick={() => onPick({ kind: "cats", flow: "expense" })}><span aria-hidden="true">⚙</span> Danh mục</button>
        <button type="button" onClick={() => onPick({ kind: "budgets" })}><span aria-hidden="true">🎯</span> Ngân sách</button>
      </div>
      <p className="menu-label">Báo cáo</p>
      <div className="menu-list">
        <button type="button" onClick={() => onPick({ kind: "report" })}><span aria-hidden="true">📊</span> Báo cáo</button>
        <button type="button" onClick={() => onPick({ kind: "pdf" })}><span aria-hidden="true">📄</span> Xuất PDF</button>
      </div>
      <p className="menu-label">Dữ liệu</p>
      <div className="menu-list">
        <button type="button" onClick={onBackup}><span aria-hidden="true">💾</span> Sao lưu</button>
        <button type="button" onClick={onRestore}><span aria-hidden="true">📥</span> Khôi phục</button>
        <button type="button" onClick={() => onPick({ kind: "cloud" })}><span aria-hidden="true">☁</span> Mây</button>
      </div>
      <div className="menu-list tail">
        <button type="button" onClick={() => onPick({ kind: "help" })}><span aria-hidden="true">❓</span> Hướng dẫn</button>
      </div>
      <div className="btns"><button type="button" className="b2" onClick={onClose}>Đóng</button></div>
    </>
  );
}

function CloudMark({ mode }: { mode: "on" | "off" | "sync" }) {
  return (
    <svg className="cloud-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.7-1.3A3.5 3.5 0 0 0 7 17z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {mode === "off" && <path d="M4.5 4.5l15 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

function CloudSheet({ email, onClose, onSignedIn, onSignedOut }: { email: string | null; onClose: () => void; onSignedIn: () => void; onSignedOut: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cloudConfig()) {
    return (
      <>
        <h3>Đưa sổ lên Supabase</h3>
        <div className="gd">
          <p>1. Tạo project trên supabase.com.</p>
          <p>2. Authentication, Providers, Email: tắt Confirm email.</p>
          <p>3. SQL Editor: chạy file supabase/schema.sql.</p>
          <p>4. Bấm Connect ở trên cùng project. Copy Project URL, dạng https://xxxx.supabase.co. Trong Settings, API Keys, tab Publishable and secret: copy khóa bắt đầu bằng sb_publishable_. Đó là khóa anon mới. Không copy sb_secret_ hay service_role.</p>
          <p>5. Tạo file .env cạnh package.json. Dán URL vào VITE_SUPABASE_URL và khóa publishable vào VITE_SUPABASE_ANON_KEY, rồi chạy lại app. Trang GitHub thì thêm hai secret cùng tên cho Actions.</p>
          <p>6. Bấm Mây, tạo một tài khoản. Điện thoại khác đăng nhập cùng email thì thấy sổ này.</p>
        </div>
        <div className="btns"><button type="button" className="b1" onClick={onClose}>Đóng</button></div>
      </>
    );
  }
  if (email) {
    return (
      <>
        <h3>Mây</h3>
        <p>Đang đăng nhập {email}. Sổ lưu trên Supabase. Icon mây ở đầu trang báo khi mất kết nối, và dòng bên cạnh là lần đồng bộ gần nhất.</p>
        <div className="btns">
          <button type="button" className="b2" onClick={() => void signOut().then(onSignedOut)}>Đăng xuất</button>
          <button type="button" className="b1" onClick={onClose}>Đóng</button>
        </div>
      </>
    );
  }
  async function submit() {
    if (password.length < 6) {
      setError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    setBusy(true);
    setError(null);
    if (mode === "in") {
      const message = await signIn(address, password);
      setBusy(false);
      if (message) setError(message);
      else onSignedIn();
      return;
    }
    const created = await signUp(address, password);
    setBusy(false);
    if (created.error) {
      setError(created.error);
      return;
    }
    if (created.needsConfirm) {
      setError("Đã tạo tài khoản. Mở email để xác nhận rồi đăng nhập, hoặc tắt Confirm email trên Supabase.");
      return;
    }
    onSignedIn();
  }
  return (
    <>
      <h3>{mode === "in" ? "Đăng nhập mây" : "Tạo tài khoản mây"}</h3>
      <label>Email</label>
      <input type="email" autoComplete="username" value={address} onChange={(event) => setAddress(event.target.value)} />
      <label>Mật khẩu</label>
      <input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
      {error && <p className="err">{error}</p>}
      <div className="btns">
        <button type="button" className="b2" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Tạo tài khoản" : "Đã có tài khoản"}</button>
        <button type="button" className="b1" disabled={busy} onClick={() => void submit()}>{busy ? "Đang làm…" : mode === "in" ? "Đăng nhập" : "Tạo"}</button>
      </div>
    </>
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

function MoneyField({ id, value, onChange }: { id?: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const pos = caret.current;
    if (pos === null) {
      if (document.activeElement === ref.current) {
        const end = ref.current.value.length;
        ref.current.setSelectionRange(end, end);
      }
      return;
    }
    caret.current = null;
    ref.current.setSelectionRange(pos, pos);
  }, [value]);

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const next = editAmount(value, event.target.value, event.target.selectionStart ?? event.target.value.length);
    caret.current = next.cursor;
    if (next.text === value) {
      event.target.value = next.text;
      event.target.setSelectionRange(next.cursor, next.cursor);
      return;
    }
    onChange(next.text);
  }

  return (
    <input
      id={id}
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={onInput}
    />
  );
}

function AccountForm({ initial, onCancel, onSave, onDelete }: { initial?: Account; onCancel: () => void; onSave: (input: AccountInput) => void; onDelete?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "bank");
  const [opening, setOpening] = useState(initial?.opening ? formatAmountTyping(String(initial.opening)) : "");
  const [limit, setLimit] = useState(initial?.limit ? formatAmountTyping(String(initial.limit)) : "");
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
      <MoneyField value={opening} onChange={setOpening} />
      {kind === "cr" && (
        <>
          <label>Hạn mức</label>
          <MoneyField value={limit} onChange={setLimit} />
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
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(names.map((name) => [name, budgets[name] ? formatAmountTyping(String(budgets[name])) : ""])));
  return (
    <>
      <h3>🎯 Ngân sách tháng theo danh mục</h3>
      <small className="hint">Để trống hoặc 0 = không giới hạn. Vượt ngân sách sẽ bị tô đỏ.</small>
      {names.map((name) => (
        <div key={name}>
          <label>{name}</label>
          <MoneyField value={texts[name] ?? ""} onChange={(value) => setTexts((current) => ({ ...current, [name]: value }))} />
        </div>
      ))}
      <div className="btns">
        <button type="button" className="b2" onClick={onCancel}>Đóng</button>
        <button type="button" className="b1" onClick={() => onSave(texts)}>Lưu</button>
      </div>
    </>
  );
}

const SCOPE_KEY = "tcgd_scope";

function readScope(): LedgerScope {
  try {
    return localStorage.getItem(SCOPE_KEY) === "personal" ? "personal" : "family";
  } catch {
    return "family";
  }
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
