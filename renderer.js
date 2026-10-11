const id = Number(new URLSearchParams(location.search).get("id"));
const note = document.getElementById("note");
const SAVE_DEBOUNCE_MS = 3000;
let timer;
let loaded = false;

// notes saved before rich text are plain strings; escape them so they render as typed
const toHtml = (content) =>
  /<\/?[a-z][\s\S]*>/i.test(content)
    ? content
    : content.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const status = document.getElementById("save-status");
const statusLabel = document.getElementById("save-label");
const STATUS_LABELS = {
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save",
};
let statusTimer;

const setStatus = (state) => {
  clearTimeout(statusTimer);
  if (state) {
    status.dataset.state = state;
    statusLabel.textContent = STATUS_LABELS[state];
  } else {
    delete status.dataset.state;
  }
};

const save = async () => {
  if (!loaded) return;
  setStatus("saving");
  try {
    await window.notes.saveNote(id, note.innerHTML);
    setStatus("saved");
    statusTimer = setTimeout(() => setStatus(null), 1500);
  } catch (e) {
    console.error(e);
    setStatus("error");
  }
};

note.addEventListener("input", () => {
  setStatus("pending");
  clearTimeout(timer);
  timer = setTimeout(save, SAVE_DEBOUNCE_MS);
});

// paste as plain text so foreign markup never enters a note
note.addEventListener("paste", (e) => {
  e.preventDefault();
  document.execCommand(
    "insertText",
    false,
    e.clipboardData.getData("text/plain"),
  );
});

const toolbar = document.getElementById("note-toolbar");
const buttons = [...toolbar.querySelectorAll("[data-cmd]")];

const syncActive = () =>
  buttons.forEach((b) =>
    b.classList.toggle("active", document.queryCommandState(b.dataset.cmd)),
  );

toolbar.addEventListener("mousedown", (e) => e.preventDefault()); // keep the selection
toolbar.addEventListener("click", (e) => {
  const cmd = e.target.closest("[data-cmd]")?.dataset.cmd;
  if (!cmd) return;
  document.execCommand(cmd); // fires "input", which triggers the debounced save
  syncActive();
});
document.addEventListener("selectionchange", syncActive);

note.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "t") {
    e.preventDefault();
    document.execCommand("strikeThrough");
    syncActive();
  }
});

window.addEventListener("beforeunload", save); // flush the last edit

document
  .getElementById("new-note")
  .addEventListener("click", () => window.notes.createNote());
// Menu dropdown
const menu = document.getElementById("menu");
const menuButton = document.getElementById("note-menu");
const pinItem = document.getElementById("menu-pin");
const swatches = [...menu.querySelectorAll(".swatch")];

const setMenuOpen = (open) => {
  menu.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
};

const applyColor = (color) => {
  document.documentElement.dataset.color = color;
  swatches.forEach((s) =>
    s.setAttribute("aria-checked", String(s.dataset.color === color)),
  );
};

menuButton.addEventListener("click", (e) => {
  e.stopPropagation();
  setMenuOpen(menu.hidden);
});

menu.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", () => setMenuOpen(false));
window.addEventListener("blur", () => setMenuOpen(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenuOpen(false);
});

swatches.forEach((swatch) =>
  swatch.addEventListener("click", () => {
    applyColor(swatch.dataset.color);
    window.notes.setColor(id, swatch.dataset.color);
  }),
);

document.getElementById("menu-notes-list").addEventListener("click", () => {
  setMenuOpen(false);
  window.notes.openList();
});

// collapse this note into the floating bubble, saving first so nothing is lost
pinItem.addEventListener("click", async () => {
  setMenuOpen(false);
  clearTimeout(timer);
  await save();
  window.notes.collapse(id);
});

document.getElementById("menu-delete").addEventListener("click", () => {
  setMenuOpen(false);
  window.notes.deleteNote(id);
});

applyColor(new URLSearchParams(location.search).get("color") ?? "yellow");

window.notes
  .getNote(id)
  .then((row) => {
    note.innerHTML = toHtml(row?.content ?? "");
    loaded = true;
  })
  .catch(console.error)
  .finally(() => {
    document.body.classList.remove("loading");
    note.contentEditable = "true";
    note.focus();
  });
