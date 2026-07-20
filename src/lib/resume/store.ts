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
    saveTimer = undefined; // pagehide 플러시가 "대기 중인 저장이 있는가"를 이 값으로 판단합니다
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      // 용량 초과·프라이빗 모드 — 저장 실패는 무시합니다.
    }
  }, SAVE_DEBOUNCE_MS);
}

/* ── 탭 간 동기화 + 종료 직전 플러시 ──
 * storage 이벤트는 같은 오리진의 **다른 탭**이 localStorage를 쓸 때만 옵니다.
 * 구독하지 않으면 탭마다 메모리 사본이 따로 놀다가 마지막에 저장한 탭이
 * 다른 탭의 편집을 통째로 덮어씁니다. 여기서는 다른 탭의 저장을 즉시
 * 받아들여(마지막 쓰기 승리) 두 탭이 같은 문서를 보게 합니다.
 *
 * pagehide: 디바운스(400ms)가 남은 채로 탭을 닫으면 마지막 편집이 사라지므로
 * 종료 직전에 즉시 기록합니다. unload가 아니라 pagehide를 쓰는 이유는
 * unload 리스너가 bfcache를 통째로 비활성화하기 때문입니다. */
let syncAttached = false;
function attachTabSync(): void {
  if (syncAttached || typeof window === 'undefined') return;
  syncAttached = true;

  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    if (e.newValue === null) {
      current = emptyResume();
    } else {
      try {
        current = coerceResume(JSON.parse(e.newValue));
      } catch {
        return; // 손상된 쓰기는 무시 — 이 탭의 사본을 지킵니다
      }
    }
    // 방금 storage에서 읽었으므로 다시 저장하지 않습니다 (echo 방지)
    for (const listener of listeners) listener();
  });

  window.addEventListener('pagehide', () => {
    if (saveTimer === undefined || current === null) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      /* 무시 */
    }
  });
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
  attachTabSync(); // 첫 구독 시 1회 — 구독은 클라이언트에서만 일어납니다
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
