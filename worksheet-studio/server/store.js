// Simple JSON-file storage for users, sessions, and saved worksheets.
// Swap this out for a real database (Postgres, SQLite, ...) in production.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const dbFile = path.join(dataDir, "db.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(dbFile, "utf8"));
  } catch {
    return { users: {}, sessions: {}, worksheets: [] };
  }
}

let db = load();

function persist() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

export const store = {
  getUser(id) {
    return db.users[id] || null;
  },
  upsertUser(user) {
    db.users[user.id] = { ...(db.users[user.id] || {}), ...user };
    persist();
    return db.users[user.id];
  },
  createSession(userId) {
    const token = crypto.randomUUID();
    db.sessions[token] = { userId, createdAt: Date.now() };
    persist();
    return token;
  },
  getSession(token) {
    return db.sessions[token] || null;
  },
  deleteSession(token) {
    delete db.sessions[token];
    persist();
  },
  listWorksheets(userId) {
    return db.worksheets
      .filter((w) => w.userId === userId)
      .map(({ id, title, gradeLevel, passageType, createdAt, sections }) => ({
        id,
        title,
        gradeLevel,
        passageType,
        createdAt,
        sectionCount: sections ? Object.keys(sections).length : 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  getWorksheet(userId, id) {
    return db.worksheets.find((w) => w.userId === userId && w.id === id) || null;
  },
  saveWorksheet(userId, worksheet) {
    const record = { ...worksheet, userId, id: crypto.randomUUID(), createdAt: Date.now() };
    db.worksheets.push(record);
    persist();
    return record;
  },
  deleteWorksheet(userId, id) {
    const before = db.worksheets.length;
    db.worksheets = db.worksheets.filter((w) => !(w.userId === userId && w.id === id));
    persist();
    return db.worksheets.length < before;
  },
  countWorksheetsThisMonth(userId) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return db.worksheets.filter((w) => w.userId === userId && w.createdAt >= start.getTime()).length;
  },
};
