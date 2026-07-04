import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

export default function HistoryDrawer({ onClose, onOpen, notify }) {
  const [items, setItems] = useState(null);
  const [query, setQuery] = useState("");

  async function load() {
    try {
      const { worksheets } = await api.listWorksheets();
      setItems(worksheets);
    } catch (err) {
      notify(err.message, "error");
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((w) => (w.title || "").toLowerCase().includes(q));
  }, [items, query]);

  async function remove(id) {
    if (!confirm("Delete this worksheet? This cannot be undone.")) return;
    try {
      await api.deleteWorksheet(id);
      setItems((xs) => xs.filter((x) => x.id !== id));
      notify("Worksheet deleted.");
    } catch (err) {
      notify(err.message, "error");
    }
  }

  return (
    <div className="drawer-overlay no-print" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>워크시트 기록</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close worksheet drawer">
            ✕
          </button>
        </div>
        <p className="muted small">저장한 워크시트를 다시 열고 PDF로 내보낼 수 있어요.</p>

        <input
          className="input history-search"
          placeholder="워크시트 검색…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {filtered === null && <p className="muted">불러오는 중…</p>}
        {filtered?.length === 0 && (
          <p className="muted">{query ? "검색 결과가 없어요." : "아직 저장한 워크시트가 없어요."}</p>
        )}

        <ul className="history-list">
          {filtered?.map((w) => (
            <li key={w.id} className="history-item">
              <button className="history-open" onClick={() => onOpen(w.id)}>
                <strong>{w.title}</strong>
                <span className="history-meta">
                  <span className="chip chip-teal">{w.gradeLevel}</span>
                  <span className="chip">{w.passageType === "literature" ? "Literature" : "Informational"}</span>
                  <span className="muted small">
                    {w.sectionCount} sections · {new Date(w.createdAt).toLocaleDateString()}
                  </span>
                </span>
              </button>
              <button className="btn btn-ghost btn-danger" onClick={() => remove(w.id)} title="Delete worksheet">
                삭제
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
