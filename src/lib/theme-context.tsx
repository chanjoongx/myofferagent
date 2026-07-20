"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  subscribeTheme,
  subscribeSystemTheme,
  getThemeSnapshot,
  getThemeServerSnapshot,
  systemTheme,
  resolveTheme,
  applyResolvedTheme,
  setTheme as persistTheme,
  type Theme,
} from "./prefs-store";

export type { Theme };

interface ThemeContextType {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  resolved: "dark",
  setTheme: () => {},
});

/**
 * 시스템 테마를 구독한다.
 *
 * `theme === 'system'`일 때 OS 설정이 바뀌면 즉시 따라가야 합니다.
 * 서버에서는 항상 'dark'를 돌려주어 하이드레이션 스냅샷을 고정합니다.
 */
function useSystemTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeSystemTheme,
    systemTheme,
    () => "dark" as const,
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  /* 저장된 설정과 시스템 설정을 각각 외부 스토어로 구독합니다.
   * useState 초기화 함수에서 localStorage를 읽던 예전 방식은
   * 서버 렌더('dark')와 불일치를 일으켜 매 로드마다 다크가 번쩍였습니다. */
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const system = useSystemTheme();

  const resolved = theme === "system" ? system : theme;

  /* DOM 동기화.
   *
   * 예전에는 이 effect가 **깜빡임의 원인**이었습니다 — 첫 페인트 이후에 실행되니
   * 라이트 테마 사용자는 다크를 먼저 보고 나서 바뀌었습니다.
   * 이제는 인라인 스크립트가 페인트 전에 이미 맞춰 놓으므로, 여기서는
   * 시스템 테마 변경처럼 나중에 생기는 변화만 따라가면 됩니다. */
  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: persistTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { resolveTheme };
