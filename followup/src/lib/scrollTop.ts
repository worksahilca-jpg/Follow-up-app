/**
 * Scrolls the page back to its top. On a computer the white sheet scrolls,
 * not the window (A-331, .app-sheet in globals.css); on a phone the window
 * does. Both are asked, so callers need not know which.
 */
export function scrollPageTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0 });
  document.querySelector(".app-sheet")?.scrollTo({ top: 0 });
}
