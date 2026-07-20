/**
 * 클라이언트 전용 사용자 설정 저장소 (테마 · 언어)
 * ------------------------------------------------------------------
 * 두 값 모두 localStorage와 브라우저 설정에서 오므로 **서버는 알 수 없습니다.**
 *
 * ⚠️ 예전 구현은 `useState(() => localStorage.getItem(...))` 였습니다.
 * 서버는 항상 `<html lang="ko" class="dark">` 와 한국어 본문을 프리렌더하는데
 * 클라이언트는 다른 값으로 하이드레이션하니 **불일치가 발생**하고, React가
 * 서버가 만든 서브트리를 버린 뒤 다시 그립니다. 실제 증상:
 *  - 영어 브라우저 사용자는 랜딩 페이지가 한국어 → 영어로 바뀌는 걸 봅니다
 *  - 라이트 테마 사용자는 매 로드마다 다크가 번쩍입니다
 *
 * `useSyncExternalStore`는 **서버 스냅샷과 클라이언트 스냅샷을 따로** 받도록
 * 설계되어 있어 정확히 이 상황을 위한 API입니다.
 * (`lib/resume/store.ts`가 같은 이유로 이미 이 패턴을 씁니다.)
 *
 * 테마의 **깜빡임 자체**는 React로는 못 없앱니다 — 첫 페인트보다 늦기 때문입니다.
 * `layout.tsx`의 차단형 인라인 스크립트가 페인트 전에 class를 심고,
 * 여기 스토어는 그 값을 그대로 이어받습니다.
 */

export type Theme = 'light' | 'dark' | 'system';
export type Locale = 'ko' | 'en';

/* ────────────────────────────────────────────
   공통
   ──────────────────────────────────────────── */

type Listener = () => void;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // 프라이빗 모드 등
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 무시 */
  }
}

/* ────────────────────────────────────────────
   테마
   ──────────────────────────────────────────── */

/** 서버 렌더 기본값 — 참조가 고정되어야 무한 렌더를 피합니다 */
const SERVER_THEME: Theme = 'system';

let themeValue: Theme | null = null;
const themeListeners = new Set<Listener>();

function readTheme(): Theme {
  if (themeValue === null) {
    if (typeof window === 'undefined') return SERVER_THEME;
    const saved = readStorage('theme');
    themeValue = saved === 'light' || saved === 'dark' ? saved : 'system';
  }
  return themeValue;
}

export function subscribeTheme(cb: Listener): () => void {
  themeListeners.add(cb);
  return () => {
    themeListeners.delete(cb);
  };
}

export function getThemeSnapshot(): Theme {
  return readTheme();
}

export function getThemeServerSnapshot(): Theme {
  return SERVER_THEME;
}

export function setTheme(next: Theme): void {
  themeValue = next;
  writeStorage('theme', next);
  applyResolvedTheme(resolveTheme(next));
  for (const l of themeListeners) l();
}

export function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? systemTheme() : theme;
}

/** html 요소에 테마를 반영 — 인라인 스크립트와 동일한 동작 */
export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

/** 시스템 테마 변경 구독 — theme === 'system'일 때만 의미가 있습니다 */
export function subscribeSystemTheme(cb: Listener): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/* ────────────────────────────────────────────
   언어
   ──────────────────────────────────────────── */

const SERVER_LOCALE: Locale = 'ko';

let localeValue: Locale | null = null;
const localeListeners = new Set<Listener>();

function readLocale(): Locale {
  if (localeValue === null) {
    if (typeof window === 'undefined') return SERVER_LOCALE;
    const saved = readStorage('locale');
    if (saved === 'ko' || saved === 'en') {
      localeValue = saved;
    } else {
      localeValue = (navigator.language || '').startsWith('en') ? 'en' : 'ko';
    }
  }
  return localeValue;
}

export function subscribeLocale(cb: Listener): () => void {
  localeListeners.add(cb);
  return () => {
    localeListeners.delete(cb);
  };
}

export function getLocaleSnapshot(): Locale {
  return readLocale();
}

export function getLocaleServerSnapshot(): Locale {
  return SERVER_LOCALE;
}

export function setLocale(next: Locale): void {
  localeValue = next;
  writeStorage('locale', next);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const l of localeListeners) l();
}

/* ────────────────────────────────────────────
   첫 페인트 전에 실행되는 인라인 스크립트
   ──────────────────────────────────────────── */

/**
 * `layout.tsx`의 `<head>`에 인라인으로 삽입됩니다.
 * React가 하이드레이션하기 **전에** class와 lang을 맞춰서 깜빡임을 없앱니다.
 * 여기 로직은 위의 `readTheme`/`readLocale`과 반드시 동일해야 합니다.
 */
export const PREFS_INIT_SCRIPT = `(function(){try{
var d=document.documentElement,s=localStorage;
var t=s.getItem('theme');
var r=(t==='light'||t==='dark')?t:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
d.classList.remove('light','dark');d.classList.add(r);d.style.colorScheme=r;
var l=s.getItem('locale');
if(l!=='ko'&&l!=='en')l=(navigator.language||'').indexOf('en')===0?'en':'ko';
d.lang=l;
}catch(e){}})();`;
