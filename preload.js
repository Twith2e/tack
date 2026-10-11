const { contextBridge } = require("electron");
const { ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
});

contextBridge.exposeInMainWorld("platform", process.platform);

contextBridge.exposeInMainWorld("bubble", {
  open: () => ipcRenderer.invoke("bubble:open"),
  dragStart: () => ipcRenderer.send("bubble:dragStart"),
  dragMove: (dx, dy) => ipcRenderer.send("bubble:dragMove", dx, dy),
  menu: () => ipcRenderer.send("bubble:menu"),
});

contextBridge.exposeInMainWorld("notes", {
  saveNote: (id, content) => ipcRenderer.invoke("note:save", id, content),
  getNote: (id) => ipcRenderer.invoke("note:get", id),
  createNote: () => ipcRenderer.invoke("note:create"),
  setColor: (id, color) => ipcRenderer.invoke("note:setColor", id, color),
  openList: () => ipcRenderer.invoke("notes:openList"),
  collapse: (id) => ipcRenderer.invoke("bubble:collapse", id),
  listNotes: () => ipcRenderer.invoke("notes:list"),
  openNote: (id) => ipcRenderer.invoke("note:open", id),
  deleteNote: (id) => ipcRenderer.invoke("note:delete", id),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setTheme: (theme) => ipcRenderer.invoke("settings:setTheme", theme),
  onNotesChanged: (callback) =>
    ipcRenderer.on("notes:changed", () => callback()),
});
