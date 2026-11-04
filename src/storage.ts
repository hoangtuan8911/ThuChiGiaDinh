import { freshData } from "./defaults";
import { normalize } from "./migrate";
import type { AppData } from "./types";

export const STORAGE_KEY = "tcgd_v2";
const LEGACY_KEY = "tcgd_v1";
const BROKEN_KEY = "tcgd_v2_broken";
const UNDO_KEY = "tcgd_v2_undo";
const REV_KEY = "tcgd_v2_rev";

export interface LoadResult {
  data: AppData;
  error: string | null;
  revision: number;
}

export interface StoredBook {
  data: AppData;
  revision: number;
}

/** Bản nào được lưu sau thì thắng. Cùng lần lưu thì giữ sổ đang mở. */
export function pickNewer(local: StoredBook, mirror: StoredBook | null): StoredBook {
  if (mirror && mirror.revision > local.revision) return mirror;
  return local;
}

/** Đọc bản IndexedDB. Bản cũ không có số lần lưu được tính là lần 1. */
export function storedBookFromMirror(value: unknown): StoredBook | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if ("data" in record && typeof record.revision === "number" && Number.isFinite(record.revision)) {
    const data = normalize(record.data);
    if (!data) return null;
    return { data, revision: record.revision };
  }
  const data = normalize(value);
  if (!data) return null;
  return { data, revision: 1 };
}

let knownRevision = 0;

export function rememberRevision(revision: number): void {
  if (revision > knownRevision) knownRevision = revision;
}

export function currentRevision(): number {
  return knownRevision;
}

export function loadAppData(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = normalize(JSON.parse(raw));
      if (data) return finishLoad(data, null, true);
      localStorage.setItem(BROKEN_KEY, raw);
      return finishLoad(freshData(), "Dữ liệu trên máy không đọc được. Đã mở sổ mới, bản hỏng vẫn được giữ.", false);
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = normalize(JSON.parse(legacy));
      if (data) return finishLoad(data, null, true);
    }
    return finishLoad(freshData(), null, false);
  } catch {
    return finishLoad(freshData(), "Không đọc được dữ liệu trên máy.", false);
  }
}

function finishLoad(data: AppData, error: string | null, persisted: boolean): LoadResult {
  const revision = readLocalRevision(persisted);
  rememberRevision(revision);
  return { data, error, revision };
}

function readLocalRevision(persisted: boolean): number {
  if (!persisted) return 0;
  try {
    const raw = localStorage.getItem(REV_KEY);
    const parsed = raw ? Number(raw) : 0;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {
    // Không đọc được số lần lưu thì coi như sổ vừa mở.
  }
  return 1;
}

export function saveAppData(data: AppData): string | null {
  const revision = knownRevision + 1;
  knownRevision = revision;
  let error: string | null = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(REV_KEY, String(revision));
  } catch {
    error = "Không lưu được trên máy này. Hãy tắt tab Riêng tư và mở bằng Safari.";
  }
  void writeMirror(data, revision);
  return error;
}

/** Ghi bản hiện tại sang IndexedDB mà không tăng số lần lưu. */
export function mirrorCurrent(data: AppData): Promise<void> {
  return writeMirror(data, knownRevision);
}

const MIRROR_DB = "tcgd";
const MIRROR_STORE = "book";

/** Bản thứ hai. Safari có thể xóa localStorage khi tắt hẳn, IndexedDB thường vẫn còn. */
export function loadMirror(): Promise<StoredBook | null> {
  return openMirror().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        const get = db.transaction(MIRROR_STORE, "readonly").objectStore(MIRROR_STORE).get(STORAGE_KEY);
        get.onsuccess = () => {
          db.close();
          resolve(storedBookFromMirror(get.result));
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      }),
  );
}

function writeMirror(data: AppData, revision: number): Promise<void> {
  return openMirror().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve();
          return;
        }
        const tx = db.transaction(MIRROR_STORE, "readwrite");
        const store = tx.objectStore(MIRROR_STORE);
        const get = store.get(STORAGE_KEY);
        get.onsuccess = () => {
          const existing = storedBookFromMirror(get.result);
          if (!existing || existing.revision < revision) {
            store.put({ revision, data: JSON.parse(JSON.stringify(data)) as AppData }, STORAGE_KEY);
          }
        };
        const done = () => {
          db.close();
          resolve();
        };
        tx.oncomplete = done;
        tx.onerror = done;
        tx.onabort = done;
      }),
  );
}

function openMirror(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open(MIRROR_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MIRROR_STORE)) request.result.createObjectStore(MIRROR_STORE);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
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
