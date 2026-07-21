"use client";

import Link from "next/link";
import {
  Crosshair,
  PenLine,
  BarChart3,
  Globe,
  Zap,
  FileEdit,
  ArrowRight,
  Languages,
  Sun,
  Moon,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n-context";
import { useTheme } from "@/lib/theme-context";
import type { LucideIcon } from "lucide-react";

/* ── Agent step ── */
interface Step {
  icon: LucideIcon;
  nameKey: string;
  descKey: string;
}

const STEPS: Step[] = [
  { icon: Crosshair, nameKey: "step.triage", descKey: "step.triage.desc" },
  { icon: PenLine, nameKey: "step.builder", descKey: "step.builder.desc" },
  { icon: BarChart3, nameKey: "step.analyzer", descKey: "step.analyzer.desc" },
  { icon: Globe, nameKey: "step.scout", descKey: "step.scout.desc" },
  { icon: Zap, nameKey: "step.match", descKey: "step.match.desc" },
  { icon: FileEdit, nameKey: "step.writer", descKey: "step.writer.desc" },
];

/* ── Nav Controls ── */
function NavControls() {
  const { locale, setLocale, t } = useLanguage();
  const { resolved, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-border bg-surface-elevated/60 text-text-secondary backdrop-blur transition-colors hover:border-accent/40 hover:text-text-primary"
        aria-label={t("theme.toggle")}
      >
        {resolved === "dark" ? (
          <Sun className="h-3.5 w-3.5" />
        ) : (
          <Moon className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Language toggle */}
      <button
        onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
        className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-elevated/60 px-3 py-1.5 text-xs text-text-secondary backdrop-blur transition-colors hover:border-accent/40 hover:text-text-primary"
        aria-label={t("nav.switchLanguage")}
      >
        <Languages className="h-3.5 w-3.5" />
        {locale === "ko" ? "EN" : "KO"}
      </button>
    </div>
  );
}

/* ── Main ──
 * 랜딩은 **한 화면**입니다: nav(상단) + 히어로(남는 공간 전부, 수직 중앙)
 * + 에이전트 워크플로 스트립(하단 고정)이 min-h-dvh 플렉스 컬럼 안에 삽니다.
 * overflow-hidden으로 강제로 자르지 않으므로, 초소형 화면에서는 잘리는 대신
 * 자연스럽게 스크롤이 생깁니다. */
export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      {/* Background */}
      <div className="hero-glow" />
      <div className="grid-bg absolute inset-0 pointer-events-none opacity-40" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-6 pt-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-text-primary hover:text-accent transition-colors"
          aria-label={t("nav.home")}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-surface">
            <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
          </div>
          My Offer{" "}
          <span className="text-accent">Agent</span>
        </Link>
        <NavControls />
      </nav>

      {/* ── Hero ── */}
      {/* gap·py는 sm 미만에서 줄입니다 — 667px(iPhone SE)에서도 한 화면에 들어가야 합니다. */}
      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center sm:gap-6 sm:py-10">
        <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-elevated/50 px-4 py-1.5 text-xs text-text-secondary backdrop-blur">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          {t("landing.badge")}
        </div>

        <h1 className="animate-rise text-5xl font-bold tracking-tight leading-[1.06] sm:text-6xl lg:text-7xl [animation-delay:70ms]">
          {t("landing.title1")}{" "}
          <span className="text-accent">{t("landing.title2")}</span>
        </h1>

        <p className="animate-rise max-w-xl text-base sm:text-lg text-text-secondary leading-relaxed whitespace-pre-line [animation-delay:140ms]">
          {t("landing.subtitle")}
        </p>

        <div className="animate-rise flex flex-col items-center gap-3 [animation-delay:210ms]">
          <Link
            href="/agent"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-surface transition-all hover:brightness-110 hover:shadow-lg hover:shadow-accent/25 active:scale-[0.97]"
          >
            {t("landing.cta")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <span className="text-xs text-text-secondary/80">{t("landing.ctaHint")}</span>
        </div>
      </main>

      {/* ── Agent Workflow: 뷰포트 하단 스트립 ── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl shrink-0 px-6 pb-6 sm:pb-8">
        <h2 className="animate-rise mb-4 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-text-secondary sm:mb-6 [animation-delay:280ms]">
          {t("landing.flowTitle")}
        </h2>

        {/* Desktop timeline (lg+) */}
        <div className="animate-rise hidden lg:grid grid-cols-6 gap-0 [animation-delay:340ms]">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.nameKey} className="group relative flex flex-col items-center text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute top-5 left-[calc(50%+22px)] h-px w-[calc(100%-44px)] bg-surface-border" />
                )}

                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface-elevated text-text-secondary transition-all group-hover:border-accent/50 group-hover:text-accent group-hover:shadow-lg group-hover:shadow-accent/10">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </div>

                <span className="mt-2.5 text-[13px] font-semibold text-text-primary">
                  {t(step.nameKey)}
                </span>
                <span className="mt-1 px-2 text-[11px] leading-snug text-text-secondary">
                  {t(step.descKey)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mobile / Tablet compact grid (설명은 sm+에서만) */}
        <div className="animate-rise grid grid-cols-3 gap-2 lg:hidden [animation-delay:340ms]">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.nameKey}
                className="flex flex-col items-center rounded-xl border border-surface-border bg-surface-elevated/40 p-3 text-center transition-colors hover:border-accent/30 hover:bg-surface-elevated/70"
              >
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <span className="text-xs font-semibold text-text-primary">
                  {t(step.nameKey)}
                </span>
                <span className="mt-1 hidden text-[10px] leading-snug text-text-secondary line-clamp-2 sm:block">
                  {t(step.descKey)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
