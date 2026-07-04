// 두 가지 백엔드:
//  - 기본(로컬 개발/개인용): Express 서버의 /api/* 엔드포인트
//  - pp 모드(`vite build --mode pp`, 페이지앤펜슬 내장판): claude-proxy + Supabase 직접 호출
import { ppApi } from "./pp-backend.js";

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const serverApi = {
  bootstrap: () => request("/api/bootstrap"),
  importFiles: (files) => request("/api/import/files", { method: "POST", body: JSON.stringify({ files }) }),
  createJob: (payload) => request("/api/generation/jobs", { method: "POST", body: JSON.stringify(payload) }),
  getJob: (id) => request(`/api/generation/jobs/${id}`),
  listWorksheets: () => request("/api/worksheets"),
  getWorksheet: (id) => request(`/api/worksheets/${encodeURIComponent(id)}`),
  saveWorksheet: (worksheet) => request("/api/worksheets", { method: "POST", body: JSON.stringify({ worksheet }) }),
  deleteWorksheet: (id) => request(`/api/worksheets/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const api = import.meta.env.MODE === "pp" ? ppApi : serverApi;
