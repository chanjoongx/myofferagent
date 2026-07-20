'use client';

/**
 * 이력서 정본을 다루는 React 훅
 * ------------------------------------------------------------------
 * 이력서는 클라이언트가 보관하고 매 요청마다 서버로 되돌려 보냅니다.
 *  - 서버는 무상태로 유지되어 Workers에 그대로 배포됩니다 (DB 불필요)
 *  - 사용자가 패널에서 직접 고친 내용이 다음 턴에 에이전트에게 그대로 전달됩니다
 *  - localStorage 덕분에 새로고침해도 작성 중이던 이력서가 살아남습니다
 *    (기존에는 새로고침 한 번에 전부 사라졌습니다)
 *
 * 실제 저장소는 `store.ts`에 있고, 이 훅은 그 위의 얇은 래퍼입니다.
 */

import { useSyncExternalStore, useCallback } from 'react';
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  setResume,
  updateResume,
  resetResume,
} from './store';
import {
  upsertListItem,
  removeListItem,
  completeness,
  threeWayMerge,
  coerceResume,
  type ResumeDocument,
  type ListSection,
} from './schema';

export function useResume() {
  const doc = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** 최상위 필드 부분 수정 (편집 패널용) */
  const patch = useCallback((partial: Partial<ResumeDocument>) => {
    updateResume((prev) => ({ ...prev, ...partial }));
  }, []);

  /** basics 안의 한 필드 수정 */
  const setBasicsField = useCallback(
    (field: keyof ResumeDocument['basics'], value: string) => {
      updateResume((prev) => ({ ...prev, basics: { ...prev.basics, [field]: value } }));
    },
    [],
  );

  const upsertItem = useCallback((section: ListSection, item: Record<string, unknown>) => {
    updateResume((prev) => upsertListItem(prev, section, item));
  }, []);

  const removeItem = useCallback((section: ListSection, id: string) => {
    updateResume((prev) => removeListItem(prev, section, id));
  }, []);

  /**
   * 서버가 돌려준 문서를 **사용자의 진행 중 편집을 보존하며** 적용한다.
   * `base`는 요청을 보낼 때의 문서입니다.
   */
  const applyServerDoc = useCallback((base: ResumeDocument, server: ResumeDocument) => {
    // 서버 페이로드는 SSE로 온 신뢰할 수 없는 JSON입니다. threeWayMerge는 세 인자가
    // 모두 온전한 ResumeDocument라고 가정하고 `theirs[section].map`을 호출하므로,
    // education 등이 배열이 아니면 던집니다. coerce로 형태를 보장해 병합이 절대
    // 던지지 않게 합니다 (onDone에서 던지면 말풍선이 영원히 스트리밍 상태로 남습니다).
    const safeServer = coerceResume(server);
    updateResume((ours) => threeWayMerge(base, ours, safeServer));
  }, []);

  return {
    doc,
    completeness: completeness(doc),
    /** 서버 문서 적용 (3-way 병합) */
    applyServerDoc,
    /** 무조건 교체 — 병합이 필요 없는 경우에만 */
    setDoc: setResume,
    patch,
    setBasicsField,
    upsertItem,
    removeItem,
    reset: resetResume,
  };
}
