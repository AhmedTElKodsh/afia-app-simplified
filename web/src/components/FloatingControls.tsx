import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export function FloatingControls() {
  const { lang, toggle: toggleLang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  return (
    <div className="fixed right-3 top-3 z-50 flex gap-2 pointer-events-auto">
      <button aria-label="language" onClick={toggleLang}
        className="rounded-full bg-white/80 dark:bg-black/60 backdrop-blur px-3 py-1 text-sm shadow">
        {lang === "en" ? "ع" : "EN"}
      </button>
      <button aria-label="theme" onClick={toggleTheme}
        className="rounded-full bg-white/80 dark:bg-black/60 backdrop-blur px-3 py-1 text-sm shadow">
        {theme === "light" ? "☾" : "☀"}
      </button>
    </div>
  );
}
