import { createContext, useContext, type ReactNode } from "react";

export type View = "overview" | "accounts" | "categories" | "history";

const NavigateContext = createContext<(view: View) => void>(() => {});

export function NavigateProvider({ value, children }: { value: (view: View) => void; children: ReactNode }) {
  return <NavigateContext.Provider value={value}>{children}</NavigateContext.Provider>;
}

export function useGo(): (view: View) => void {
  return useContext(NavigateContext);
}
