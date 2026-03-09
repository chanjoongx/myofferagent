"use client";

import { useLanguage } from "@/lib/i18n-context";
import { isSafeUrl } from "@/lib/url-utils";
import type { JobSearchResult } from "@/lib/types";

interface JobCardProps {
  job: JobSearchResult;
  onAnalyze?: (job: JobSearchResult) => void;
}

/* ── 근무 형태 스타일 (모듈 최상위에서 1회 생성) ── */
const TYPE_STYLES: Record<
  JobSearchResult["type"],
  { labelKey: string; className: string }
> = {
  remote: { labelKey: "job.remote", className: "bg-emerald-500/15 text-emerald-400" },
  onsite: { labelKey: "job.onsite", className: "bg-blue-500/15 text-blue-400" },
  hybrid: { labelKey: "job.hybrid", className: "bg-purple-500/15 text-purple-400" },
};

const TYPE_FALLBACK = { labelKey: "job.onsite", className: "bg-gray-500/15 text-gray-400" };

function MiniMatchRing({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative flex items-center justify-center shrink-0" role="img" aria-label={`Match ${value}%`}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-surface-border"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-accent transition-all duration-500"
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="absolute text-[10px] font-bold">{value}%</span>
    </div>
  );
}

export default function JobCard({ job, onAnalyze }: JobCardProps) {
  const { t } = useLanguage();

  const typeInfo = TYPE_STYLES[job.type] ?? TYPE_FALLBACK;

  return (
    <article className="group rounded-2xl border border-surface-border bg-surface-elevated p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:border-accent/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold truncate">{job.company}</h3>
          <p className="text-sm text-text-secondary mt-0.5 truncate">
            {job.position}
          </p>
        </div>
        <MiniMatchRing value={job.estimatedMatch} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary">{job.location}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${typeInfo.className}`}
        >
          {t(typeInfo.labelKey)}
        </span>
      </div>

      {job.requirements.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-text-secondary line-clamp-3">
          {job.requirements.slice(0, 3).join(" · ")}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {onAnalyze && (
          <button
            onClick={() => onAnalyze(job)}
            className="rounded-lg bg-accent/10 px-3.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
          >
            {t("job.analyze")}
          </button>
        )}
        {isSafeUrl(job.url) ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-surface-border px-3.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
            aria-label={`${t("job.viewPosting")} - ${job.company}`}
          >
            {t("job.viewPosting")} ↗
          </a>
        ) : (
          <span className="rounded-lg border border-surface-border px-3.5 py-1.5 text-xs text-text-secondary/50">
            {t("job.viewPosting")}
          </span>
        )}
      </div>
    </article>
  );
}
