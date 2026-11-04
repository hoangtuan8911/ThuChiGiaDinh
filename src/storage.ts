import { freshData } from "./defaults";
import { normalize } from "./migrate";
import type { AppData } from "./types";

export const STORAGE_KEY = "tcgd_v2";
const LEGACY_KEY = "tcgd_v1";
const BROKEN_KEY = "tcgd_v2_broken";
const UNDO_KEY = "tcgd_v2_undo";

export interface LoadResult {
  data: AppData;
  error: string | null;
}

export function loadAppData(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = normalize(JSON.parse(raw));
      if (data) return { data, error: null };
      localStorage.setItem(BROKEN_KEY, raw);
      return { data: freshData(), error: "Dữ liệu trên máy không đọc được. Đã mở sổ mới, bản hỏng vẫn được giữ." };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = normalize(JSON.parse(legacy));
      if (data) return { data, error: null };
    }
    return { data: freshData(), error: null };
  } catch {
    return { data: freshData(), error: "Không đọc được dữ liệu trên máy." };
  }
}

export function saveAppData(data: AppData): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return "Không lưu được trên máy này.";
  }
}

export function loadUndo(): AppData | null {
  try {
    const raw = localStorage.getItem(UNDO_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveUndo(data: AppData | null): void {
  if (!data) localStorage.removeItem(UNDO_KEY);
  else localStorage.setItem(UNDO_KEY, JSON.stringify(data));
}
