import { describe, expect, it } from "vitest";
import { planSync } from "./cloudSync";

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
