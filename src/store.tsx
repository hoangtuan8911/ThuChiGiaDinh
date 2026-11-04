import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { todayISO } from "./format";
import {
  adjustBalance as adjustBalanceLedger,
  createAccount as createAccountLedger,
  freshState,
  removeAccount as removeAccountLedger,
  removeCategory as removeCategoryLedger,
  removeEntry as removeEntryLedger,
  saveCategory as saveCategoryLedger,
  saveEntry as saveEntryLedger,
  updateAccount as updateAccountLedger,
  type Result,
} from "./ledger";
import { buildSample } from "./sample";
import { loadState, saveState } from "./storage";
import type { AccountPatch, AdjustInput, CategoryInput, EntryInput, NewAccountInput, State } from "./types";

interface LedgerApi {
  state: State;
  createAccount: (input: NewAccountInput) => Result;
  updateAccount: (input: AccountPatch) => Result;
  removeAccount: (id: string) => Result;
  adjustBalance: (input: AdjustInput) => Result;
  saveCategory: (input: CategoryInput) => Result;
  removeCategory: (id: string) => Result;
  saveEntry: (input: EntryInput) => Result;
  removeEntry: (id: string) => Result;
  replaceState: (state: State) => void;
  resetAll: () => void;
  loadSample: () => void;
}

const LedgerContext = createContext<LedgerApi | null>(null);

function stamp(): string {
  return new Date().toISOString();
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const api = useMemo<LedgerApi>(() => {
    const commit = (result: Result): Result => {
      if (result.ok) setState(result.state);
      return result;
    };
    return {
      state,
      createAccount: (input) => commit(createAccountLedger(state, input, stamp())),
      updateAccount: (input) => commit(updateAccountLedger(state, input)),
      removeAccount: (id) => commit(removeAccountLedger(state, id)),
      adjustBalance: (input) => commit(adjustBalanceLedger(state, input, stamp())),
      saveCategory: (input) => commit(saveCategoryLedger(state, input, stamp())),
      removeCategory: (id) => commit(removeCategoryLedger(state, id)),
      saveEntry: (input) => commit(saveEntryLedger(state, input, stamp())),
      removeEntry: (id) => commit(removeEntryLedger(state, id)),
      replaceState: (next) => setState(next),
      resetAll: () => setState(freshState()),
      loadSample: () => setState((current) => buildSample(todayISO(), current)),
    };
  }, [state]);

  return <LedgerContext.Provider value={api}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerApi {
  const api = useContext(LedgerContext);
  if (!api) throw new Error("useLedger phải nằm trong LedgerProvider");
  return api;
}
