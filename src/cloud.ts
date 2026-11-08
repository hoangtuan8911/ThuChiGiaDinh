import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalize } from "./migrate";
import type { AppData } from "./types";

const STAMP_KEY = "tcgd_cloud_stamp";
const DIRTY_KEY = "tcgd_cloud_dirty";

export function cloudConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== "string" || typeof anonKey !== "string") return null;
  const trimmedUrl = url.trim();
  const trimmedKey = anonKey.trim();
  if (!trimmedUrl.startsWith("https://") || trimmedKey.length < 20) return null;
  return { url: trimmedUrl, anonKey: trimmedKey };
}

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  const config = cloudConfig();
  if (!config) return null;
  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(8000) }),
      },
    });
  }
  return client;
}

export function readStamp(): string | null {
  try {
    return localStorage.getItem(STAMP_KEY);
  } catch {
    return null;
  }
}

export function writeStamp(value: string | null): void {
  try {
    if (!value) localStorage.removeItem(STAMP_KEY);
    else localStorage.setItem(STAMP_KEY, value);
  } catch {
    /* Máy không cho ghi thì lần sau sẽ hỏi lại. */
  }
}

export function readDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDirty(value: boolean): void {
  try {
    if (value) localStorage.setItem(DIRTY_KEY, "1");
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* Bỏ qua. */
  }
}

export async function currentEmail(): Promise<string | null> {
  const supabase = db();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const supabase = db();
  if (!supabase) return "Chưa cấu hình Supabase.";
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? error.message : null;
}

export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirm: boolean }> {
  const supabase = db();
  if (!supabase) return { error: "Chưa cấu hình Supabase.", needsConfirm: false };
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { error: error.message, needsConfirm: false };
  return { error: null, needsConfirm: !data.session };
}

export async function signOut(): Promise<void> {
  const supabase = db();
  if (!supabase) return;
  await supabase.auth.signOut();
  writeStamp(null);
  writeDirty(false);
}

export interface RemoteBook {
  book: AppData;
  updatedAt: string;
}

export async function pullBook(): Promise<{ ok: true; remote: RemoteBook | null } | { ok: false; error: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, error: "Chưa cấu hình Supabase." };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập." };
  const { data, error } = await supabase.from("books").select("payload, updated_at").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, remote: null };
  const book = normalize(data.payload);
  if (!book) return { ok: false, error: "Sổ trên mây không đọc được." };
  return { ok: true, remote: { book, updatedAt: String(data.updated_at) } };
}

export async function pushBook(book: AppData): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, error: "Chưa cấu hình Supabase." };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập." };
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("books").upsert(
    { user_id: userId, payload: book, updated_at: updatedAt },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, updatedAt };
}
