"use client";

import { useState, memo } from "react";
import Link from "next/link";
import {
  Crosshair,
  PenLine,
  BarChart3,
  Globe,
  Zap,
  FileEdit,
  Check,
  Languages,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Plus,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n-context";
import { useTheme, type Theme } from "@/lib/theme-context";
import { AGENT_NAMES } from "@/lib/agents/constants";
import type { LucideIcon } from "lucide-react";

interface AgentDef {
  id: string;
  icon: LucideIcon;
  labelKey: string;
}

const AGENTS: AgentDef[] = [
  { id: AGENT_NAMES.TRIAGE, icon: Crosshair, labelKey: "step.triage" },
  { id: AGENT_NAMES.BUILDER, icon: PenLine, labelKey: "step.builder" },
  { id: AGENT_NAMES.ANALYZER, icon: BarChart3, labelKey: "step.analyzer" },
  { id: AGENT_NAMES.SCOUT, icon: Globe, labelKey: "step.scout" },
  { id: AGENT_NAMES.MATCH, icon: Zap, labelKey: "step.match" },
  { id: AGENT_NAMES.WRITER, icon: FileEdit, labelKey: "step.writer" },
];

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "theme.light" },
  { value: "dark", icon: Moon, labelKey: "theme.dark" },
  { value: "system", icon: Monitor, labelKey: "theme.system" },
];

interface AgentStatusPanelProps {
  currentAgent: string;
  completedAgents: string[];
  onAgentSelect?: (agentId: string) => void;
  onNewConversation?: () => void;
  isLoading?: boolean;
}

export default memo(function AgentStatusPanel({
  currentAgent,
  completedAgents,
  onAgentSelect,
  onNewConversation,
  isLoading,
}: AgentStatusPanelProps) {
  const { locale, setLocale, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentIdx = AGENTS.findIndex((a) => a.id === currentAgent);
  const CurrentIcon = currentIdx >= 0 ? AGENTS[currentIdx].icon : Crosshair;
  const currentLabel = currentIdx >= 0 ? t(AGENTS[currentIdx].labelKey) : "Agent";

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo (desktop) ── */}
      <Link
        href="/"
        className="hidden md:flex items-center gap-2 px-5 pt-5 pb-2 text-sm font-semibold tracking-tight text-text-primary hover:text-accent transition-colors"
        aria-label="Go to home page"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-surface">
          <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
        </div>
        <span>
          My Offer <span className="text-accent">Agent</span>
        </span>
      </Link>

      {/* ══════════════════════════════════════════
          Mobile: Compact current-agent bar + drawer
         ══════════════════════════════════════════ */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex w-full items-center gap-3 px-4 py-3"
          aria-expanded={mobileOpen}
          aria-label="Toggle agent list"
        >
          {/* Current agent icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-surface">
            <CurrentIcon className="h-4 w-4" strokeWidth={2} />
          </div>

          {/* Current agent name + step counter */}
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-semibold text-text-primary truncate">
              {currentLabel}
            </span>
            <span className="text-[10px] text-text-secondary">
              {t("sidebar.step", {
                current: String(currentIdx + 1),
                total: String(AGENTS.length),
              })}
            </span>
          </div>

          {/* Step dots */}
          <div className="ml-auto flex items-center gap-1.5">
            {AGENTS.map((agent) => {
              const isDone = completedAgents.includes(agent.id);
              const isCurrent = currentAgent === agent.id;
              return (
                <div
                  key={agent.id}
                  className={`h-1.5 rounded-full transition-all ${
                    isCurrent
                      ? "w-4 bg-accent"
                      : isDone
                        ? "w-1.5 bg-accent/50"
                        : "w-1.5 bg-surface-border"
                  }`}
                />
              );
            })}
          </div>

          <ChevronDown
            className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${
              mobileOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="drawer-enter border-t border-surface-border px-3 pb-3">
            <div className="grid grid-cols-3 gap-2 pt-2">
              {AGENTS.map((agent) => {
                const isCurrent = currentAgent === agent.id;
                const isDone = completedAgents.includes(agent.id);
                const Icon = agent.icon;
                const canClick = onAgentSelect && !isCurrent && !isLoading;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={!canClick}
                    onClick={() => {
                      if (canClick) {
                        onAgentSelect(agent.id);
                        setMobileOpen(false);
                      }
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 transition-all ${
                      isCurrent
                        ? "bg-accent/10 border border-accent/30"
                        : isDone
                          ? "opacity-60"
                          : "opacity-30"
                    } ${canClick ? "hover:bg-accent/5 cursor-pointer" : "cursor-default"}`}
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        isCurrent
                          ? "bg-accent text-surface"
                          : isDone
                            ? "bg-surface-elevated border border-surface-border text-accent"
                            : "bg-surface-elevated border border-surface-border text-text-secondary"
                      }`}
                    >
                      {isDone ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      ) : (
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-center leading-tight">
                      {t(agent.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Mobile bottom controls */}
            <div className="mt-2 flex items-center gap-2">
              {/* Home */}
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 items-center justify-center rounded-lg border border-surface-border bg-surface-elevated/40 px-2.5 text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
                aria-label="Go to home page"
              >
                <Zap className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>

              {/* New conversation */}
              {onNewConversation && (
                <button
                  onClick={() => { onNewConversation(); setMobileOpen(false); }}
                  disabled={isLoading}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface-elevated/40 text-[11px] text-text-secondary transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                  {t("sidebar.newChat")}
                </button>
              )}

              {/* Language toggle */}
              <button
                onClick={() => { setLocale(locale === "ko" ? "en" : "ko"); }}
                className="flex h-8 items-center justify-center gap-1 rounded-lg border border-surface-border bg-surface-elevated/40 px-2.5 text-[11px] text-text-secondary hover:border-accent/40 hover:text-text-primary transition-colors"
                aria-label={`Switch to ${locale === "ko" ? "English" : "한국어"}`}
              >
                <Languages className="h-3 w-3" />
                <span>{locale === "ko" ? "EN" : "한"}</span>
              </button>

              {/* Theme toggle */}
              <div className="flex h-8 rounded-lg border border-surface-border overflow-hidden">
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex items-center justify-center w-8 transition-colors ${
                        isActive
                          ? "bg-accent/15 text-accent"
                          : "bg-surface-elevated/40 text-text-secondary hover:text-text-primary"
                      }`}
                      aria-label={t(opt.labelKey)}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          Desktop: Full vertical agent list
         ══════════════════════════════════════════ */}
      <nav
        className="hidden md:flex flex-1 flex-col gap-1 px-2 pt-5"
        aria-label="Agent workflow steps"
      >
        <div className="mb-2 px-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
            {t("sidebar.title")}
          </span>
        </div>

        {AGENTS.map((agent, i) => {
          const isCurrent = currentAgent === agent.id;
          const isDone = completedAgents.includes(agent.id);
          const Icon = agent.icon;
          const canClick = onAgentSelect && !isCurrent && !isLoading;

          return (
            <div key={agent.id} className="relative flex items-start shrink-0">
              {/* Vertical connector */}
              {i < AGENTS.length - 1 && (
                <div className="absolute left-[21px] top-[36px] w-px h-[calc(100%-12px)] bg-surface-border" />
              )}

              <button
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onAgentSelect(agent.id)}
                className={`relative z-10 flex items-center gap-3 w-full rounded-xl px-3 py-2 transition-all text-left ${
                  isCurrent
                    ? "bg-accent/10 border border-accent/40"
                    : isDone
                      ? "opacity-70"
                      : "opacity-35"
                } ${canClick ? "hover:bg-accent/5 hover:opacity-100 cursor-pointer" : "cursor-default"}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isCurrent
                      ? "bg-accent text-surface"
                      : isDone
                        ? "bg-surface-elevated border border-surface-border text-accent"
                        : "bg-surface-elevated border border-surface-border text-text-secondary"
                  }`}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium truncate">
                    {t(agent.labelKey)}
                  </span>
                  {isDone && (
                    <span className="text-[10px] text-accent leading-none">
                      {t("sidebar.done")}
                    </span>
                  )}
                </div>

                {isCurrent && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* ── Bottom controls (desktop) ── */}
      <div className="hidden md:flex flex-col gap-2 px-4 pb-4 pt-2">
        {/* New conversation */}
        {onNewConversation && (
          <button
            onClick={onNewConversation}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-surface-border bg-surface-elevated/40 px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-accent/40 hover:text-accent w-full disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {t("sidebar.newChat")}
          </button>
        )}

        {/* Theme toggle */}
        <div className="flex rounded-lg border border-surface-border overflow-hidden">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                aria-label={t(opt.labelKey)}
                title={t(opt.labelKey)}
              >
                <Icon className="h-3 w-3" />
              </button>
            );
          })}
        </div>

        {/* Language toggle */}
        <button
          onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
          className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-elevated/40 px-3 py-1.5 text-[11px] text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary w-full justify-center"
          aria-label={`Switch language to ${locale === "ko" ? "English" : "한국어"}`}
        >
          <Languages className="h-3 w-3" />
          {locale === "ko" ? "English" : "한국어"}
        </button>
      </div>
    </div>
  );
});
