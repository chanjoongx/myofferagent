/**
 * 이력서 외부 저장소 (external store)
 * ------------------------------------------------------------------
 * `useSyncExternalStore`가 구독하는 모듈 수준 저장소입니다.
 *
 * 왜 `useState` + `useEffect`가 아닌가:
 *  - localStorage는 SSR 시점에 없으므로, 마운트 후 불러오면 하이드레이션
 *    불일치가 납니다. 흔히 `useEffect(() => setState(load()))`로 때우지만
 *    이는 연쇄 렌더를 유발하고 React Compiler 린트가 오류로 잡습니다.
 *  - `useSyncExternalStore`는 **서버 스냅샷과 클라이언트 스냅샷을 분리**해
 *    받도록 설계되어 있어, 정확히 이 상황을 위한 API입니다.
 *
 * 부수 효과로 이력서 상태가 컴포넌트 트리 밖에 있게 되어, 프롭 드릴링 없이
 * 어느 컴포넌트에서든 구독할 수 있습니다.
 */

import { emptyResume, coerceResume, type ResumeDocument } from './schema';

const STORAGE_KEY = 'moa.resume.v1';
const SAVE_DEBOUNCE_MS = 400;

/** 서버 렌더 시 사용하는 **참조가 고정된** 스냅샷.
 *  매번 새 객체를 반환하면 무한 렌더 루프가 납니다. */
const SERVER_SNAPSHOT: ResumeDocument = emptyResume();

let current: ResumeDocument | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function loadFromStorage(): ResumeDocument {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyResume();
    // coerceResume는 throw하지 않습니다 — 손상된 저장본은 빈 이력서가 됩니다.
    return coerceResume(JSON.parse(raw));
  } catch {
    return emptyResume();
  }
}

function persist(doc: ResumeDocument): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      // 용량 초과·프라이빗 모드 — 저장 실패는 무시합니다.
    }
  }, SAVE_DEBOUNCE_MS);
}

/** 현재 문서. 최초 호출 시 localStorage에서 한 번만 읽어 캐시합니다. */
function read(): ResumeDocument {
  if (current === null) {
    current = typeof window === 'undefined' ? SERVER_SNAPSHOT : loadFromStorage();
  }
  return current;
}

/* ── useSyncExternalStore 계약 ── */

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getSnapshot(): ResumeDocument {
  return read();
}

export function getServerSnapshot(): ResumeDocument {
  return SERVER_SNAPSHOT;
}

/* ── 변경 ── */

function commit(next: ResumeDocument, options: { persist?: boolean } = {}): void {
  current = next;
  if (options.persist !== false) persist(next);
  for (const listener of listeners) listener();
}

/** 문서를 통째로 교체 (서버가 패치해 돌려준 결과 등) */
export function setResume(next: ResumeDocument): void {
  commit(coerceResume(next));
}

/** 이전 값을 기반으로 갱신 */
export function updateResume(fn: (prev: ResumeDocument) => ResumeDocument): void {
  commit(coerceResume(fn(read())));
}

/** 빈 이력서로 초기화하고 저장본도 삭제 */
export function resetResume(): void {
  clearTimeout(saveTimer);
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
  // persist를 건너뜁니다 — 켜 두면 방금 지운 키를 400ms 뒤에 다시 씁니다.
  commit(emptyResume(), { persist: false });
}
