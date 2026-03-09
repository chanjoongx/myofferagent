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
        aria-label={`Switch language to ${locale === "ko" ? "English" : "한국어"}`}
      >
        <Languages className="h-3.5 w-3.5" />
        {locale === "ko" ? "EN" : "KO"}
      </button>
    </div>
  );
}

/* ── Main ── */
export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="hero-glow" />
      <div className="grid-bg absolute inset-0 pointer-events-none opacity-40" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-text-primary hover:text-accent transition-colors"
          aria-label="My Offer Agent home"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-surface">
            <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
          </div>
          My Offer{" "}
          <span className="text-accent">Agent</span>
        </Link>
        <NavControls />
      </nav>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pt-24 pb-20 sm:pt-32">
        {/* ── Hero ── */}
        <section className="flex flex-col items-center text-center gap-6 mb-28 sm:mb-36">
          <div className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-elevated/50 px-4 py-1.5 text-xs text-text-secondary backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
            {t("landing.badge")}
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.08]">
            {t("landing.title1")}
            <br />
            <span className="text-accent">{t("landing.title2")}</span>
          </h1>

          <p className="max-w-lg text-base sm:text-lg text-text-secondary leading-relaxed whitespace-pre-line">
            {t("landing.subtitle")}
          </p>

          <Link
            href="/agent"
            className="group mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 text-sm font-semibold text-surface transition-all hover:brightness-110 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.97]"
          >
            {t("landing.cta")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>

        {/* ── Agent Workflow ── */}
        <section>
          <h2 className="text-center text-xs font-medium uppercase tracking-[0.2em] text-text-secondary mb-14">
            {t("landing.flowTitle")}
          </h2>

          {/* Desktop timeline (lg+) */}
          <div className="hidden lg:grid grid-cols-6 gap-0">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.nameKey} className="group flex flex-col items-center text-center relative">
                  {i < STEPS.length - 1 && (
                    <div className="absolute top-5 left-[calc(50%+22px)] w-[calc(100%-44px)] h-px bg-surface-border" />
                  )}

                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface-elevated text-text-secondary transition-all group-hover:border-accent/50 group-hover:text-accent group-hover:shadow-lg group-hover:shadow-accent/10">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </div>

                  <span className="mt-3 text-sm font-semibold text-text-primary">
                    {t(step.nameKey)}
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-text-secondary px-2">
                    {t(step.descKey)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile / Tablet grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:hidden">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.nameKey}
                  className="group flex flex-col items-center text-center rounded-2xl border border-surface-border bg-surface-elevated/40 p-5 transition-all hover:border-accent/30 hover:bg-surface-elevated/70"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent mb-3">
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <span className="text-sm font-semibold text-text-primary">
                    {t(step.nameKey)}
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-text-secondary">
                    {t(step.descKey)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
