/**
 * /agent 진입 시 보여 주는 스켈레톤.
 *
 * 구조는 실제 화면과 **동일해야** 합니다: `.app-shell`이 세로 컨테이너이고,
 * 그 안의 요소가 반응형으로 가로 배치를 맡습니다 (page.tsx + ChatInterface와 동일).
 * 예전에는 `flex app-shell`만 주고 사이드바·채팅을 직접 자식으로 두었는데,
 * `.app-shell`의 `flex-direction: column` 때문에 **사이드바가 채팅 위로 쌓이고**
 * 오른쪽 테두리가 화면 중간에 떠 있었습니다.
 */
export default function AgentLoading() {
  return (
    <div className="app-shell w-full">
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
      {/* Sidebar skeleton — 실제 사이드바(md:w-56 lg:w-60)와 같은 폭이어야
          하이드레이션 시 레이아웃이 튀지 않습니다 */}
      <div className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col border-r border-surface-border glass p-5 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-surface-border animate-pulse" />
          <div className="h-4 w-28 rounded bg-surface-border animate-pulse" />
        </div>
        {/* Agent items */}
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className="h-7 w-7 shrink-0 rounded-lg bg-surface-border animate-pulse" />
              <div className="h-3.5 rounded bg-surface-border animate-pulse" style={{ width: `${60 + i * 8}px` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Chat area skeleton */}
      <div className="flex flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 border-b border-surface-border px-4 py-3">
          <div className="h-7 w-7 rounded-lg bg-surface-border animate-pulse" />
          <div className="h-4 w-20 rounded bg-surface-border animate-pulse" />
        </div>

        {/* Messages area */}
        <div className="flex-1 p-6">
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-surface-border animate-pulse shrink-0" />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-surface-border animate-pulse" />
              <div className="h-20 w-72 rounded-2xl bg-surface-border/50 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Input skeleton */}
        <div className="border-t border-surface-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-surface-border animate-pulse" />
            <div className="flex-1 h-10 rounded-xl bg-surface-border/50 animate-pulse" />
            <div className="h-9 w-9 rounded-lg bg-surface-border animate-pulse" />
          </div>
        </div>
      </div>

      {/* Resume panel skeleton — 실제 우측 컬럼(md:w-80 lg:w-96)과 동일 폭.
          없으면 하이드레이션 순간 채팅 영역이 이 폭만큼 좁아지며 튑니다. */}
      <div className="hidden md:flex md:w-80 lg:w-96 shrink-0 flex-col border-l border-surface-border p-5 gap-4">
        <div className="h-4 w-24 rounded bg-surface-border animate-pulse" />
        <div className="h-2 w-full rounded-full bg-surface-border/60 animate-pulse" />
        <div className="mt-2 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded-lg bg-surface-border/50 animate-pulse" />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
