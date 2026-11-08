export interface RemoteStamp {
  updatedAt: string;
  count: number;
}

export interface SyncInput {
  localCount: number;
  remote: RemoteStamp | null;
  syncedAt: string | null;
  dirty: boolean;
}

/** upload: đưa sổ máy này lên mây. download: lấy sổ mây. ready: hai bên đang khớp. ask: cả hai đều đổi. */
export type SyncAction = "upload" | "download" | "ready" | "ask";

export type CloudMode = "on" | "off" | "sync";

/** Icon mây và dòng giờ đồng bộ. syncedLabel là giờ đã định dạng, hoặc null nếu chưa từng đồng bộ. */
export function cloudStatus(input: {
  configured: boolean;
  signedIn: boolean;
  online: boolean;
  syncing: boolean;
  failed: boolean;
  syncedLabel: string | null;
}): { mode: CloudMode; title: string; detail: string } {
  const detail = input.syncedLabel ? `Đồng bộ lần cuối ${input.syncedLabel}` : "Chưa đồng bộ";
  if (!input.configured) return { mode: "off", title: "Chưa nối Supabase", detail: "" };
  if (input.syncing && !input.signedIn) return { mode: "sync", title: "Đang nối Supabase…", detail: "" };
  if (!input.signedIn) return { mode: "off", title: "Chưa đăng nhập", detail: input.syncedLabel ? detail : "" };
  if (input.syncing) return { mode: "sync", title: "Đang đồng bộ", detail };
  if (!input.online || input.failed) return { mode: "off", title: "Mất kết nối Supabase", detail };
  return { mode: "on", title: "Đã kết nối Supabase", detail };
}

export function planSync(input: SyncInput): SyncAction {
  if (!input.remote) return "upload";
  if (input.syncedAt && input.remote.updatedAt === input.syncedAt) {
    return input.dirty ? "upload" : "ready";
  }
  if (!input.syncedAt) {
    if (input.localCount === 0) return "download";
    if (input.remote.count === 0) return "upload";
    return "ask";
  }
  if (input.dirty) return "ask";
  return "download";
}
