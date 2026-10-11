document.documentElement.dataset.platform = window.platform;

const syncFocus = () =>
  document.body.classList.toggle("focused", document.hasFocus());
window.addEventListener("focus", syncFocus);
window.addEventListener("blur", syncFocus);
syncFocus();

document
  .getElementById("close-note")
  ?.addEventListener("click", () => window.close());
