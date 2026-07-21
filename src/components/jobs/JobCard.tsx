"use client";

import { CalendarDays } from "lucide-react";
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
  remote: { labelKey: "job.remote", className: "bg-emerald-500/15 text-emerald-400 light:text-emerald-700" },
  onsite: { labelKey: "job.onsite", className: "bg-blue-500/15 text-blue-400 light:text-blue-600" },
  hybrid: { labelKey: "job.hybrid", className: "bg-purple-500/15 text-purple-400 light:text-purple-700" },
};

const TYPE_FALLBACK = { labelKey: "job.onsite", className: "bg-gray-500/15 text-gray-400 light:text-gray-600" };

function MiniMatchRing({ value }: { value: number }) {
  const { t } = useLanguage();
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative flex items-center justify-center shrink-0" role="img" aria-label={t("job.matchLabel", { value: String(value) })}>
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
        {/* 스폰서십 여부 — 서버 도구가 수집하는 값입니다. 이 앱의 주 사용자는
            미국 취업 자격이 없어서, "불가"는 매칭률보다 먼저 봐야 하는 정보입니다. */}
        {job.sponsorship === "no-sponsorship" && (
          <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-medium text-red-400 light:text-red-600">
            {t("job.noSponsorship")}
          </span>
        )}
        {job.sponsorship === "sponsors" && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 light:text-emerald-700">
            {t("job.sponsors")}
          </span>
        )}
        {/* 게시일 — Scout이 검색 결과에서 실제로 본 문자열만 옵니다 (추측 금지 규칙).
            비어 있으면 신선도를 확인 못 한 공고이므로 아무것도 표시하지 않습니다.
            라벨은 sr-only 텍스트로 붙입니다 — 일반 span의 aria-label은 ARIA에서
            금지라 스크린리더 대부분이 무시합니다. */}
        {job.postedDate && (
          <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">{t("job.posted")}: </span>
            {job.postedDate}
          </span>
        )}
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
