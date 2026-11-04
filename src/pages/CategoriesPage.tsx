import { useState } from "react";
import { CategoryDialog } from "../components/CategoryDialog";
import { ConfirmDialog } from "../components/ui";
import { useLedger } from "../store";
import type { Category, Flow } from "../types";

export function CategoriesPage() {
  const { state } = useLedger();
  const [creating, setCreating] = useState<null | { flow: Flow; parentId?: string }>(null);
  const [editing, setEditing] = useState<Category | null>(null);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Danh mục</h1>
          <p className="lede">Mỗi khoản thu hoặc chi gắn một màu. Danh mục con tách chi tiết, ví dụ Ăn uống gồm Đi chợ và Cafe.</p>
        </div>
      </header>
      <div className="columns">
        <CategoryColumn
          flow="income"
          title="Danh mục thu"
          categories={state.categories}
          onCreate={(parentId) => setCreating({ flow: "income", parentId })}
          onEdit={setEditing}
        />
        <CategoryColumn
          flow="expense"
          title="Danh mục chi"
          categories={state.categories}
          onCreate={(parentId) => setCreating({ flow: "expense", parentId })}
          onEdit={setEditing}
        />
      </div>
      {creating && (
        <CategoryDialog flow={creating.flow} parentId={creating.parentId} onClose={() => setCreating(null)} />
      )}
      {editing && <CategoryDialog flow={editing.flow} category={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryColumn({
  flow,
  title,
  categories,
  onCreate,
  onEdit,
}: {
  flow: Flow;
  title: string;
  categories: Category[];
  onCreate: (parentId?: string) => void;
  onEdit: (category: Category) => void;
}) {
  const roots = categories.filter((category) => category.flow === flow && !category.parentId);
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        <button type="button" className="btn small" onClick={() => onCreate()}>
          Thêm danh mục
        </button>
      </header>
      {roots.length === 0 ? (
        <p className="muted">Chưa có danh mục. Thêm danh mục gốc, rồi thêm danh mục con nếu cần.</p>
      ) : (
        <ul className="category-list">
          {roots.map((root) => {
            const children = categories.filter((category) => category.parentId === root.id);
            return (
              <li key={root.id} className="category-group" style={{ borderLeftColor: root.color }}>
                <CategoryRow category={root} onEdit={() => onEdit(root)} onAddChild={() => onCreate(root.id)} />
                {children.length > 0 && (
                  <ul>
                    {children.map((child) => (
                      <li key={child.id}>
                        <CategoryRow category={child} onEdit={() => onEdit(child)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CategoryRow({
  category,
  onEdit,
  onAddChild,
}: {
  category: Category;
  onEdit: () => void;
  onAddChild?: () => void;
}) {
  const { state, removeCategory } = useLedger();
  const [confirming, setConfirming] = useState(false);
  const childCount = state.categories.filter((item) => item.parentId === category.id).length;

  return (
    <div className="category-row">
      <span className="dot" style={{ background: category.color }} />
      <span className="category-name">{category.name}</span>
      <span className="row-actions">
        {onAddChild && (
          <button type="button" className="text-btn" onClick={onAddChild}>
            Thêm con
          </button>
        )}
        <button type="button" className="text-btn" onClick={onEdit}>
          Sửa
        </button>
        <button type="button" className="text-btn danger" onClick={() => setConfirming(true)}>
          Xóa
        </button>
      </span>
      {confirming && (
        <ConfirmDialog
          title={`Xóa ${category.name}?`}
          body={
            childCount
              ? `Danh mục và ${childCount} danh mục con sẽ bị xóa. Giao dịch cũ vẫn nằm trong lịch sử.`
              : "Giao dịch cũ vẫn nằm trong lịch sử, kèm tên danh mục tại thời điểm ghi."
          }
          confirmLabel="Xóa danh mục"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            removeCategory(category.id);
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
