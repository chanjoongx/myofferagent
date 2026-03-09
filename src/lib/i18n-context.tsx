"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { type Locale, t as translate } from "./i18n";

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "ko",
  setLocale: () => {},
  t: (key) => key,
});

/** 브라우저 저장값 또는 시스템 언어에서 초기 로케일을 결정 */
function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "ko";
  const saved = localStorage.getItem("locale") as Locale | null;
  if (saved === "ko" || saved === "en") return saved;
  const browser = navigator.language || "";
  return browser.startsWith("en") ? "en" : "ko";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  // DOM lang 속성 동기화
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  const tFn = useCallback(
    (key: string, params?: Record<string, string>) => translate(locale, key, params),
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: tFn }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLanguage() {
  return useContext(I18nContext);
}
