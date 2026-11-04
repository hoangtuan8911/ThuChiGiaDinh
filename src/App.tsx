import { useEffect, useState } from "react";
import { currentMonth, formatMonth, formatVnd } from "./format";
import { monthFlow } from "./ledger";
import { NavigateProvider, useGo, type View } from "./nav";
import { AccountsPage } from "./pages/AccountsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { OverviewPage } from "./pages/OverviewPage";
import { LedgerProvider, useLedger } from "./store";

const VIEWS: { id: View; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "accounts", label: "Tài khoản" },
  { id: "categories", label: "Danh mục" },
  { id: "history", label: "Lịch sử" },
];

function readView(): View {
  const hash = window.location.hash.replace("#", "");
  if (hash === "accounts" || hash === "categories" || hash === "history" || hash === "overview") return hash;
  return "overview";
}

export function App() {
  return (
    <LedgerProvider>
      <Shell />
    </LedgerProvider>
  );
}

function Shell() {
  const [view, setView] = useState<View>(() => readView());

  useEffect(() => {
    const sync = () => setView(readView());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const titles: Record<View, string> = {
      overview: "Tổng quan",
      accounts: "Tài khoản",
      categories: "Danh mục",
      history: "Lịch sử",
    };
    document.title = `${titles[view]} · Sổ nhà`;
    window.scrollTo(0, 0);
  }, [view]);

  const navigate = (next: View) => {
    const hash = `#${next}`;
    if (window.location.hash !== hash) window.location.hash = next;
    else setView(next);
  };

  return (
    <NavigateProvider value={navigate}>
      <div className="app">
        <a className="skip" href="#content">
          Đến nội dung
        </a>
        <Sidebar view={view} />
        <div className="workspace">
          <MobileBar />
          <main id="content">
            {view === "overview" && <OverviewPage />}
            {view === "accounts" && <AccountsPage />}
            {view === "categories" && <CategoriesPage />}
            {view === "history" && <HistoryPage />}
          </main>
        </div>
        <BottomNav view={view} />
      </div>
    </NavigateProvider>
  );
}

function Sidebar({ view }: { view: View }) {
  const go = useGo();
  const { state } = useLedger();
  const month = currentMonth();
  const flow = monthFlow(state.entries, month);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect x="6" y="4" width="20" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M11 12h10M11 17h10M11 22h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span>
          <strong>Sổ nhà</strong>
          <small>Thu chi gia đình</small>
        </span>
      </div>
      <nav className="nav" aria-label="Mục chính">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? "nav-btn active" : "nav-btn"}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            <NavIcon name={item.id} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="side-pulse">
        <span>{formatMonth(month)}</span>
        <p>
          <small>Thu</small>
          <strong>{formatVnd(flow.income)}</strong>
        </p>
        <p>
          <small>Chi</small>
          <strong>{formatVnd(flow.expense)}</strong>
        </p>
      </div>
    </aside>
  );
}

function MobileBar() {
  return (
    <div className="mobile-bar">
      <strong>Sổ nhà</strong>
      <span>Thu chi gia đình</span>
    </div>
  );
}

function BottomNav({ view }: { view: View }) {
  const go = useGo();
  return (
    <nav className="bottom-nav" aria-label="Mục chính">
      {VIEWS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={view === item.id ? "active" : undefined}
          aria-current={view === item.id ? "page" : undefined}
          onClick={() => go(item.id)}
        >
          <NavIcon name={item.id} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function NavIcon({ name }: { name: View }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "overview") {
    return (
      <svg {...common}>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M7 10.5V20h10v-9.5" />
      </svg>
    );
  }
  if (name === "accounts") {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  if (name === "categories") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M8 6h11M8 12h11M8 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
