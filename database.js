const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const { app } = require("electron");

let db;

const getDb = () => {
  if (!db) {
    db = new DatabaseSync(path.join(app.getPath("userData"), "tack.db"), {
      timeout: 5000,
    });

    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        deleted_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT,
        color TEXT NOT NULL DEFAULT 'yellow'
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      `);

    // databases created before note colors existed
    const columns = db.prepare("PRAGMA table_info(notes)").all();
    if (!columns.some((c) => c.name === "color")) {
      db.exec("ALTER TABLE notes ADD COLUMN color TEXT NOT NULL DEFAULT 'yellow'");
    }
  }

  return db;
};

const closeDb = () => {
  db?.close();
  db = undefined;
};

const createNote = () =>
  Number(
    getDb().prepare("INSERT INTO notes (content) VALUES ('')").run()
      .lastInsertRowid,
  );

const saveNote = (id, content) =>
  getDb()
    .prepare(
      "UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
    )
    .run(content, id);

const getNote = (id) =>
  getDb()
    .prepare(
      "SELECT id, content, color, COALESCE(updated_at, created_at) AS date FROM notes WHERE deleted_at IS NULL AND id = ?",
    )
    .get(id);

const getAllNotes = () =>
  getDb()
    .prepare(
      "SELECT id, content, color, COALESCE(updated_at, created_at) AS date FROM notes WHERE deleted_at IS NULL ORDER BY COALESCE(updated_at, created_at) DESC",
    )
    .all();

const setNoteColor = (id, color) =>
  getDb()
    .prepare("UPDATE notes SET color = ? WHERE id = ? AND deleted_at IS NULL")
    .run(color, id);

const deleteNote = (id) =>
  getDb()
    .prepare("UPDATE notes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(id);

const getSetting = (key) =>
  getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value;

const setSetting = (key, value) =>
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);

module.exports = {
  getDb,
  closeDb,
  getSetting,
  setSetting,
  createNote,
  saveNote,
  setNoteColor,
  getNote,
  getAllNotes,
  deleteNote,
};
