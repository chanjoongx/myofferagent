export default function AgentLoading() {
  return (
    <div className="flex h-dvh w-full">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-60 lg:w-64 shrink-0 flex-col border-r border-surface-border glass p-5 gap-4">
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
    </div>
  );
}
