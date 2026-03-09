"use client";

import { useLanguage } from "@/lib/i18n-context";
import type { ATSAnalysis } from "@/lib/types";

interface ATSScoreCardProps {
  analysis: ATSAnalysis;
}

const SECTION_KEYS: {
  key: keyof ATSAnalysis["sections"];
  i18nKey: string;
}[] = [
  { key: "formatCompatibility", i18nKey: "ats.formatCompatibility" },
  { key: "keywordOptimization", i18nKey: "ats.keywordOptimization" },
  { key: "achievementQuality", i18nKey: "ats.achievementQuality" },
  { key: "structuralCompleteness", i18nKey: "ats.structuralCompleteness" },
  { key: "readability", i18nKey: "ats.readability" },
  { key: "grammar", i18nKey: "ats.grammar" },
];

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let color = "text-red-400";
  if (score >= 70) color = "text-accent";
  else if (score >= 40) color = "text-yellow-400";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-surface-border"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${color} transition-all duration-700`}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-xs text-text-secondary">/100</span>
      </div>
    </div>
  );
}

function ProgressBar({
  score,
  maxScore,
}: {
  score: number;
  maxScore: number;
}) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-surface-border overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-text-secondary w-14 text-right">
        {score}/{maxScore}
      </span>
    </div>
  );
}

export default function ATSScoreCard({ analysis }: ATSScoreCardProps) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 space-y-6">
      {/* Overall */}
      <div className="flex flex-col items-center gap-2">
        <ScoreRing score={analysis.overallScore} />
        <h3 className="text-lg font-semibold mt-1">{t("ats.title")}</h3>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTION_KEYS.map(({ key, i18nKey }) => {
          const sec = analysis.sections?.[key];
          if (!sec) return null;
          return (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-text-primary">{t(i18nKey)}</span>
              </div>
              <ProgressBar score={sec.score ?? 0} maxScore={sec.maxScore || 1} />
            </div>
          );
        })}
      </div>

      {/* Strengths */}
      {analysis.topStrengths?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-text-secondary">
            {t("ats.strengths")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.topStrengths.map((s) => (
              <span
                key={s}
                className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-400"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Improvements */}
      {analysis.criticalImprovements?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-text-secondary">
            {t("ats.improvements")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.criticalImprovements.map((item) => (
              <span
                key={item}
                className="rounded-full bg-orange-500/15 px-3 py-1 text-xs text-orange-400"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
