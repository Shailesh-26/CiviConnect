// Runs before the page draws, so dark mode does not flash white. Kept in a file (not inline) for the
// Content Security Policy.
(function () {
  try {
    var saved = localStorage.getItem("cc-theme");
    var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
