"use client";

import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { type Locale, t as translate } from "./i18n";
import {
  subscribeLocale,
  getLocaleSnapshot,
  getLocaleServerSnapshot,
  setLocale as persistLocale,
} from "./prefs-store";

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

export function LanguageProvider({ children }: { children: ReactNode }) {
  /* 언어는 localStorage와 navigator.language에서 오므로 서버가 알 수 없습니다.
   * 예전에는 useState 초기화 함수에서 읽어 하이드레이션 불일치를 냈고,
   * 영어 브라우저 사용자는 한국어로 그려진 화면이 영어로 바뀌는 것을 봤습니다.
   * 서버/클라이언트 스냅샷을 분리해 React가 이 차이를 정상 처리하도록 합니다.
   * (html의 lang 속성은 layout.tsx의 인라인 스크립트가 페인트 전에 맞춥니다.) */
  const locale = useSyncExternalStore(
    subscribeLocale,
    getLocaleSnapshot,
    getLocaleServerSnapshot,
  );

  const tFn = useCallback(
    (key: string, params?: Record<string, string>) => translate(locale, key, params),
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale: persistLocale, t: tFn }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLanguage() {
  return useContext(I18nContext);
}
