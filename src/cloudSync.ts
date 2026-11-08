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
