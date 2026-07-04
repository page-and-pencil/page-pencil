import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { SECTIONS } from "../constants.js";

export default function GenerateStep({ jobId, sections = [], onDone, onError, onCancel }) {
  const [logs, setLogs] = useState([]);
  const doneRef = useRef(false);
  const logBoxRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;
    let stopped = false;

    async function poll() {
      try {
        const job = await api.getJob(jobId);
        if (stopped) return;
        setLogs(job.logs || []);
        if (job.status === "done" && !doneRef.current) {
          doneRef.current = true;
          onDone(job.result);
          return;
        }
        if (job.status === "error") {
          onError(job.error || "Generation failed.");
          return;
        }
        setTimeout(poll, 1200);
      } catch (err) {
        if (!stopped) onError(err.message);
      }
    }

    poll();
    return () => {
      stopped = true;
    };
  }, [jobId]);

  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  }, [logs]);

  const chips = sections.map((id) => SECTIONS.find((s) => s.id === id)).filter(Boolean);

  return (
    <div className="generate">
      <div className="card generate-card">
        <div className="spinner" />
        <h2>워크시트를 만들고 있어요…</h2>
        <p className="muted small">AI가 선택한 섹션을 하나씩 작성 중이에요. 보통 1~3분 걸려요.</p>

        {chips.length > 0 && (
          <div className="gen-chips">
            {chips.map((c) => (
              <span key={c.id} className="gen-chip">
                {c.emoji} {c.label}
              </span>
            ))}
          </div>
        )}

        <div className="log-box" ref={logBoxRef}>
          {logs.map((l, i) => (
            <div key={i} className="log-line">
              <span className="log-time">{new Date(l.t).toLocaleTimeString()}</span> {l.msg}
            </div>
          ))}
          {logs.length === 0 && <div className="log-line muted">생성 시작을 기다리는 중…</div>}
        </div>
        <button className="btn btn-ghost" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}
