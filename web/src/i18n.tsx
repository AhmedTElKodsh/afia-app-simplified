import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "en" | "ar";
const dict: Record<Lang, Record<string, string>> = {
  en: {
    "capture.title": "Photograph the FRONT of the bottle",
    "capture.button": "Capture",
    "capture.hint": "Hold the bottle so its outline matches the guide",
    "result.consumed": "Consumed",
    "result.remaining": "Remaining",
  },
  ar: {
    "capture.title": "صوّر الوجه الأمامي للزجاجة",
    "capture.button": "التقاط",
    "capture.hint": "اضبط الزجاجة لتطابق الإطار الإرشادي",
    "result.consumed": "المستهلك",
    "result.remaining": "المتبقي",
  },
};

const Ctx = createContext<{ lang: Lang; t: (k: string) => string; toggle: () => void }>({
  lang: "en", t: (k) => k, toggle: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "en");
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("lang", lang);
  }, [lang]);
  const t = (k: string) => dict[lang][k] ?? k;
  const toggle = () => setLang((l) => (l === "en" ? "ar" : "en"));
  return <Ctx.Provider value={{ lang, t, toggle }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
