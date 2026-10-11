const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  nativeTheme,
  screen,
} = require("electron");
const {
  getDb,
  closeDb,
  getSetting,
  setSetting,
  getAllNotes,
  createNote,
  saveNote,
  setNoteColor,
  getNote,
  deleteNote,
} = require("./database");
const { ipcMain } = require("electron/main");
if (require("electron-squirrel-startup")) app.quit();
const path = require("path");

const isMac = process.platform === "darwin";
const preload = __dirname + "/preload.js";

const THEMES = ["system", "light", "dark"];
const COLORS = [
  "yellow",
  "green",
  "pink",
  "purple",
  "blue",
  "gray",
  "charcoal",
];
// nativeTheme.themeSource drives prefers-color-scheme in every window
const themed = (light, dark) =>
  nativeTheme.shouldUseDarkColors ? dark : light;

const BUBBLE_SIZE = 40;

const noteWindows = new Map();
let listWindow = null;
let bubbleWindow = null;
let bubbleOrigin = null;
let lastOpenedNoteId = null;

const notifyList = () => {
  if (listWindow && !listWindow.isDestroyed()) {
    listWindow.webContents.send("notes:changed");
  }
};

// macOS keeps the native traffic lights; Windows/Linux get a frameless window
// with the renderer's own close button
const createChromeWindow = (options) => {
  const win = new BrowserWindow({
    ...options,
    show: false,
    icon: path.join(__dirname, "icon.ico"),
    ...(isMac
      ? { titleBarStyle: "hidden", trafficLightPosition: { x: 12, y: 10 } }
      : { frame: false }),
    webPreferences: { preload },
  });

  if (isMac) {
    win.on("focus", () => win.setWindowButtonVisibility(true));
    win.on("blur", () => win.setWindowButtonVisibility(false));
  }

  win.once("ready-to-show", () => win.show());

  return win;
};

const createWindow = (noteId) => {
  lastOpenedNoteId = noteId;

  const existing = noteWindows.get(noteId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }

  const win = createChromeWindow({
    width: 320,
    height: 350,
    backgroundColor: themed("#fff8c6", "#2b2b2b"),
  });
  noteWindows.set(noteId, win);
  win.on("focus", () => {
    lastOpenedNoteId = noteId;
  });
  win.on("closed", () => noteWindows.delete(noteId));

  win.loadFile("index.html", {
    query: { id: String(noteId), color: getNote(noteId)?.color ?? "yellow" },
  });
};

const openListWindow = () => {
  if (listWindow && !listWindow.isDestroyed()) {
    if (listWindow.isMinimized()) listWindow.restore();
    listWindow.focus();
    return;
  }

  listWindow = createChromeWindow({
    width: 340,
    height: 480,
    minWidth: 260,
    minHeight: 240,
    backgroundColor: themed("#f3f1e7", "#1c1c1c"),
  });
  listWindow.on("closed", () => {
    listWindow = null;
  });
  listWindow.loadFile("list.html");
};

const closeBubble = () => {
  const win = bubbleWindow;
  bubbleWindow = null;
  if (win && !win.isDestroyed()) win.close();
};

// a small rounded always-on-top window that stands in for a collapsed note
const openBubble = (noteId, bounds) => {
  closeBubble();

  const area = screen.getDisplayMatching(bounds).workArea;
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const x = clamp(
    bounds.x + bounds.width - BUBBLE_SIZE - 8,
    area.x,
    area.x + area.width - BUBBLE_SIZE,
  );
  const y = clamp(bounds.y + 8, area.y, area.y + area.height - BUBBLE_SIZE);

  const win = new BrowserWindow({
    x,
    y,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: { preload },
  });

  win.setAlwaysOnTop(true, "floating");
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    if (bubbleWindow === win) bubbleWindow = null;
  });
  win.loadFile("bubble.html", {
    query: { color: getNote(noteId)?.color ?? "yellow" },
  });
  bubbleWindow = win;
};

const restoreFromBubble = () => {
  closeBubble();
  const target =
    lastOpenedNoteId !== null && getNote(lastOpenedNoteId)
      ? lastOpenedNoteId
      : (getAllNotes()[0]?.id ?? createNote());
  createWindow(target);
};

const removeNote = (id, parent) => {
  const note = getNote(id);
  if (note?.content.trim()) {
    const choice = dialog.showMessageBoxSync(parent, {
      type: "warning",
      buttons: ["Delete", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      message: "Delete this note?",
      detail: "This note will be removed from Tack.",
    });
    if (choice !== 0) return;
  }

  deleteNote(id);
  noteWindows.get(id)?.close();
  notifyList();
};

app
  .whenReady()
  .then(() => {
    getDb();
    const savedTheme = getSetting("theme");
    nativeTheme.themeSource = THEMES.includes(savedTheme)
      ? savedTheme
      : "system";

    const ids = getAllNotes().map((n) => n.id);
    (ids.length ? ids : [createNote()]).forEach(createWindow);

    ipcMain.handle("settings:get", () => ({ theme: nativeTheme.themeSource }));
    ipcMain.handle("settings:setTheme", (_e, theme) => {
      if (!THEMES.includes(theme)) return;
      setSetting("theme", theme);
      nativeTheme.themeSource = theme;
    });

    ipcMain.handle("note:create", () => {
      createWindow(createNote());
      notifyList();
    });
    ipcMain.handle("note:save", (_e, id, content) => {
      saveNote(id, content);
      notifyList();
    });
    ipcMain.handle("note:get", (_e, id) => getNote(id));
    ipcMain.handle("notes:list", () => getAllNotes());
    ipcMain.handle("note:open", (_e, id) => createWindow(id));
    ipcMain.handle("note:delete", (e, id) =>
      removeNote(id, BrowserWindow.fromWebContents(e.sender)),
    );
    ipcMain.handle("note:setColor", (_e, id, color) => {
      if (!COLORS.includes(color)) return;
      setNoteColor(id, color);
      notifyList();
    });
    ipcMain.handle("notes:openList", () => openListWindow());
    ipcMain.handle("bubble:collapse", (e, id) => {
      const win = BrowserWindow.fromWebContents(e.sender);
      lastOpenedNoteId = id;
      openBubble(id, win.getBounds());
      win.close();
    });
    ipcMain.handle("bubble:open", () => restoreFromBubble());
    ipcMain.on("bubble:dragStart", () => {
      bubbleOrigin = bubbleWindow?.getPosition() ?? null;
    });
    ipcMain.on("bubble:dragMove", (_e, dx, dy) => {
      if (!bubbleWindow || !bubbleOrigin) return;
      // setBounds with a fixed size: setPosition can grow the window on
      // Windows with display scaling
      bubbleWindow.setBounds({
        x: Math.round(bubbleOrigin[0] + dx),
        y: Math.round(bubbleOrigin[1] + dy),
        width: BUBBLE_SIZE,
        height: BUBBLE_SIZE,
      });
    });
    ipcMain.on("bubble:menu", () => {
      Menu.buildFromTemplate([
        { label: "Open note", click: restoreFromBubble },
        { type: "separator" },
        { label: "Quit Tack", click: () => app.quit() },
      ]).popup({ window: bubbleWindow ?? undefined });
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const remaining = getAllNotes().map((n) => n.id);
        (remaining.length ? remaining : [createNote()]).forEach(createWindow);
      }
    });
  })
  .catch((e) => {
    console.error(e);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", closeDb);
