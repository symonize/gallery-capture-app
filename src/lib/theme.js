/*
  Theme storage + application. Defaults to dark. The no-flash init in index.html
  reads the same localStorage key before paint — keep them in sync.
*/
const KEY = "gallery-capture:theme";

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore storage errors (private mode) */
  }
  applyTheme(theme);
  return theme;
}
