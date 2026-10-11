document.documentElement.dataset.color =
  new URLSearchParams(location.search).get("color") ?? "yellow";

// named `el`, not `bubble`: the preload exposes window.bubble and a top-level
// `const bubble` here would clash with it and stop the whole script
const el = document.getElementById("bubble");
const DRAG_THRESHOLD = 4;
let drag = null;

// a drag region would swallow the click, so move the window by hand and
// only treat a press that never moved as a click
el.addEventListener("pointerdown", (e) => {
  el.setPointerCapture(e.pointerId);
  drag = { x: e.screenX, y: e.screenY, moved: false };
  window.bubble.dragStart();
});

el.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.screenX - drag.x;
  const dy = e.screenY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  drag.moved = true;
  window.bubble.dragMove(dx, dy);
});

el.addEventListener("pointerup", () => {
  if (drag && !drag.moved) window.bubble.open();
  drag = null;
});

el.addEventListener("pointercancel", () => {
  drag = null;
});

el.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.bubble.menu();
});
