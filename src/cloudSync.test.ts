import { describe, expect, it } from "vitest";
import { cloudStatus, planSync } from "./cloudSync";

describe("đồng bộ mây", () => {
  it("chưa có sổ trên mây thì đẩy sổ máy lên", () => {
    expect(planSync({ localCount: 3, remote: null, syncedAt: null, dirty: true })).toBe("upload");
  });

  it("máy mới không có giao dịch thì lấy sổ mây", () => {
    expect(planSync({ localCount: 0, remote: { updatedAt: "t2", count: 4 }, syncedAt: null, dirty: false })).toBe("download");
  });

  it("cả hai máy đều có số và chưa từng khớp thì hỏi", () => {
    expect(planSync({ localCount: 2, remote: { updatedAt: "t2", count: 5 }, syncedAt: null, dirty: true })).toBe("ask");
  });

  it("mây mới hơn và máy không sửa dở thì lấy mây", () => {
    expect(planSync({ localCount: 2, remote: { updatedAt: "t3", count: 6 }, syncedAt: "t2", dirty: false })).toBe("download");
  });

  it("máy sửa sau lần khớp thì đẩy lên", () => {
    expect(planSync({ localCount: 3, remote: { updatedAt: "t2", count: 2 }, syncedAt: "t2", dirty: true })).toBe("upload");
  });

  it("hai bên cùng đổi thì hỏi", () => {
    expect(planSync({ localCount: 3, remote: { updatedAt: "t4", count: 8 }, syncedAt: "t2", dirty: true })).toBe("ask");
  });

  it("đã khớp thì giữ", () => {
    expect(planSync({ localCount: 3, remote: { updatedAt: "t2", count: 3 }, syncedAt: "t2", dirty: false })).toBe("ready");
  });
});

describe("dòng trạng thái mây", () => {
  const base = { configured: true, signedIn: true, online: true, syncing: false, failed: false, syncedLabel: "2026-11-08 11:49:00" };

  it("chưa cấu hình thì báo chưa nối", () => {
    expect(cloudStatus({ ...base, configured: false })).toEqual({ mode: "off", title: "Chưa nối Supabase", detail: "" });
  });

  it("chưa đăng nhập thì icon tắt và vẫn nhớ lần cuối", () => {
    expect(cloudStatus({ ...base, signedIn: false })).toEqual({
      mode: "off",
      title: "Chưa đăng nhập",
      detail: "Đồng bộ lần cuối 2026-11-08 11:49:00",
    });
  });

  it("đang đồng bộ", () => {
    expect(cloudStatus({ ...base, syncing: true }).mode).toBe("sync");
  });

  it("mất mạng thì hiện lần đồng bộ cuối", () => {
    expect(cloudStatus({ ...base, online: false })).toEqual({
      mode: "off",
      title: "Mất kết nối Supabase",
      detail: "Đồng bộ lần cuối 2026-11-08 11:49:00",
    });
  });

  it("gọi mây lỗi cũng tính là mất kết nối", () => {
    expect(cloudStatus({ ...base, failed: true }).mode).toBe("off");
  });

  it("đã nối thì hiện giờ đồng bộ lần cuối", () => {
    expect(cloudStatus(base)).toEqual({
      mode: "on",
      title: "Đã kết nối Supabase",
      detail: "Đồng bộ lần cuối 2026-11-08 11:49:00",
    });
  });

  it("đã nối nhưng chưa từng đồng bộ", () => {
    expect(cloudStatus({ ...base, syncedLabel: null }).detail).toBe("Chưa đồng bộ");
  });

  it("đang kiểm tra phiên thì chưa kết luận là mất kết nối", () => {
    expect(cloudStatus({ ...base, signedIn: false, syncing: true, syncedLabel: null })).toEqual({
      mode: "sync",
      title: "Đang nối Supabase…",
      detail: "",
    });
  });
});
