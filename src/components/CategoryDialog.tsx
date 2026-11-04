import { useState, type FormEvent } from "react";
import { useLedger } from "../store";
import type { Category, Flow } from "../types";
import { ColorField, FormError, Modal } from "./ui";

export function CategoryDialog({
  flow,
  category,
  parentId,
  onClose,
}: {
  flow: Flow;
  category?: Category;
  parentId?: string | null;
  onClose: () => void;
}) {
  const { state, saveCategory } = useLedger();
  const lockedFlow = category?.flow ?? flow;
  const roots = state.categories.filter((item) => item.flow === lockedFlow && item.parentId === null && item.id !== category?.id);
  const hasChildren = category ? state.categories.some((item) => item.parentId === category.id) : false;
  const initialParent = category ? category.parentId : (parentId ?? null);
  const parentColor = state.categories.find((item) => item.id === initialParent)?.color;
  const [name, setName] = useState(category?.name ?? "");
  const [parent, setParent] = useState(initialParent ?? "");
  const [color, setColor] = useState(category?.color ?? parentColor ?? (lockedFlow === "income" ? "#047857" : "#c2410c"));
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = saveCategory({
      id: category?.id,
      name,
      flow: lockedFlow,
      color,
      parentId: hasChildren ? null : parent || null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  const title = category ? "Sửa danh mục" : parentId ? "Thêm danh mục con" : "Thêm danh mục";

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form-grid" onSubmit={onSubmit}>
        <p className="hint span-2">{lockedFlow === "income" ? "Danh mục thu" : "Danh mục chi"}</p>
        <label className="field span-2">
          <span>Tên danh mục</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Đi chợ" autoFocus />
        </label>
        {hasChildren ? (
          <p className="hint span-2">Danh mục này đang có danh mục con nên giữ vai trò danh mục gốc.</p>
        ) : (
          <label className="field span-2">
            <span>Thuộc danh mục</span>
            <select value={parent} onChange={(event) => setParent(event.target.value)}>
              <option value="">Danh mục gốc</option>
              {roots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="span-2">
          <ColorField value={color} onChange={setColor} />
        </div>
        <div className="span-2">
          <FormError message={error} />
        </div>
        <div className="form-actions span-2">
          <button type="button" className="btn ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn primary">
            Lưu danh mục
          </button>
        </div>
      </form>
    </Modal>
  );
}
