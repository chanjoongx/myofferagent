'use client';

/**
 * 모바일 오버레이를 "진짜 모달"로 만들어 주는 훅 모음
 * ------------------------------------------------------------------
 * 이력서 패널은 데스크톱에서는 우측 **고정 컬럼**이지만 모바일에서는
 * `fixed inset-0`으로 화면 전체를 덮습니다. 그런데 덮기만 했을 뿐이라
 * 접근성 관점에서는 모달이 아니었습니다:
 *
 *  - 스크린 리더가 뒤쪽 대화 내용을 계속 읽을 수 있었고
 *  - Tab을 누르면 포커스가 오버레이 밖(가려진 채팅 입력창)으로 빠져나갔고
 *  - Escape로 닫을 수 없었고
 *  - 닫은 뒤 포커스가 body로 떨어져 키보드 사용자는 위치를 잃었습니다
 *
 * 데스크톱에서는 모달이 **아니므로** 이 동작들을 걸면 안 됩니다.
 * 그래서 뷰포트를 구독해서 오버레이일 때만 활성화합니다.
 */

import { useCallback, useEffect, useSyncExternalStore, type RefObject } from 'react';

/**
 * 미디어 쿼리를 구독합니다.
 *
 * 서버에서는 항상 false를 돌려주어 하이드레이션 스냅샷을 고정합니다
 * (서버는 뷰포트를 알 수 없습니다 — 추측하면 불일치가 납니다).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Tailwind의 `md` 브레이크포인트(768px) 미만 = 오버레이로 렌더되는 구간 */
export const MOBILE_QUERY = '(max-width: 767px)';

/* 포커스를 받을 수 있는 요소들. `[tabindex="-1"]`은 프로그램적 포커스 전용이라 제외합니다. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * 활성화된 동안 컨테이너를 모달처럼 동작시킵니다.
 *
 * - 열릴 때 첫 포커스 가능 요소로 포커스 이동
 * - Tab / Shift+Tab을 컨테이너 안에서 순환 (포커스 트랩)
 * - Escape로 닫기
 * - 닫힐 때 원래 포커스 위치로 복귀
 * - 열려 있는 동안 배경 스크롤 잠금
 *
 * `onClose`는 **안정된 참조**여야 합니다 (useCallback). 매 렌더 새로 만들면
 * effect가 재실행되면서 포커스가 계속 첫 요소로 되돌아갑니다.
 */
export function useModalOverlay(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    /* 숨겨진 요소는 건너뜁니다 — `display:none`인 데스크톱 전용 버튼 등. */
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );

    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        /* 편집 중에 누른 Escape는 "이 필드에서 나가겠다"는 뜻이지
         * "패널을 닫아 달라"는 뜻이 아닙니다. 필드가 알아서 블러하도록 두고
         * 여기서는 무시합니다. 한 번 더 누르면 그때 닫힙니다.
         *
         * 필드 쪽에서 stopPropagation을 하는 방법은 **통하지 않습니다**:
         * Next.js App Router는 `hydrateRoot(document, ...)`로 하이드레이션해서
         * React의 리스너도 document에 붙습니다. 같은 노드의 다른 리스너는
         * stopPropagation으로 막을 수 없으므로(그건 stopImmediatePropagation),
         * 실제로 패널이 닫혀 버렸습니다. 그래서 대상 검사로 처리합니다. */
        const el = e.target;
        const editing =
          el instanceof HTMLElement &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        if (editing) return;

        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const cur = document.activeElement;
      const outside = !(cur instanceof Node) || !container.contains(cur);

      if (e.shiftKey && (cur === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (cur === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      /* DOM에서 사라진 요소에 focus()를 부르면 아무 일도 안 일어나고
       * 포커스가 body에 남습니다 — 붙어 있을 때만 되돌립니다. */
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [active, containerRef, onClose]);
}
