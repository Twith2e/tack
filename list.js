const container = document.getElementById("notes");
const search = document.getElementById("search");
let allNotes = [];

const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

// notes are stored as HTML; DOMParser doesn't run scripts
const toText = (html) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("div, p, li").forEach((el) => el.append("\n"));
  return doc.body.textContent
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
};

// SQLite CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS"
const formatDate = (value) => {
  const date = new Date(value.replace(" ", "T") + "Z");
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const render = () => {
  const query = search.value.trim().toLowerCase();
  const notes = allNotes.filter((n) => n.content.toLowerCase().includes(query));

  container.replaceChildren();

  if (!notes.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = query ? "No notes match your search." : "No notes yet.";
    container.append(empty);
    return;
  }

  for (const n of notes) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.color = n.color;
    card.addEventListener("click", () => window.notes.openNote(n.id));

    const text = document.createElement("div");
    const content = n.content.trim();
    text.className = content ? "card-text" : "card-text empty";
    text.textContent = content || "Empty note";

    const date = document.createElement("div");
    date.className = "card-date";
    date.textContent = formatDate(n.date);

    const del = document.createElement("button");
    del.className = "card-delete";
    del.title = "Delete note";
    del.setAttribute("aria-label", "Delete note");
    del.innerHTML = TRASH_ICON;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      window.notes.deleteNote(n.id);
    });

    card.append(text, date, del);
    container.append(card);
  }
};

const load = () =>
  window.notes
    .listNotes()
    .then((rows) => {
      allNotes = rows.map((r) => ({ ...r, content: toText(r.content) }));
      render();
    })
    .catch(console.error);

const notesView = document.getElementById("notes-view");
const settingsView = document.getElementById("settings-view");
const viewTitle = document.getElementById("view-title");
const themeRadios = [...document.querySelectorAll('input[name="theme"]')];

const showView = (name) => {
  notesView.hidden = name !== "notes";
  settingsView.hidden = name !== "settings";
  viewTitle.textContent = name === "settings" ? "Settings" : "Notes";
};

document
  .getElementById("open-settings")
  .addEventListener("click", () => showView("settings"));
document
  .getElementById("back-to-notes")
  .addEventListener("click", () => showView("notes"));

themeRadios.forEach((radio) =>
  radio.addEventListener("change", () => window.notes.setTheme(radio.value)),
);

window.notes
  .getSettings()
  .then(({ theme }) => {
    themeRadios.forEach((radio) => (radio.checked = radio.value === theme));
  })
  .catch(console.error);

search.addEventListener("input", render);
document
  .getElementById("new-note")
  .addEventListener("click", () => window.notes.createNote());
window.notes.onNotesChanged(load);

load();
