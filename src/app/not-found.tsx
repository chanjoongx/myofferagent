"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { useLanguage } from "@/lib/i18n-context";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-6">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-surface">
          <Zap className="h-7 w-7" strokeWidth={2} />
        </div>

        {/* 404 */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tighter text-text-primary">
            404
          </h1>
          <p className="text-lg text-text-secondary">
            {t("notFound.subtitle")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-xl border border-surface-border bg-surface-elevated px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 hover:bg-accent/5"
          >
            {t("notFound.home")}
          </Link>
          <Link
            href="/agent"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
          >
            {t("notFound.agent")}
          </Link>
        </div>
      </div>
    </main>
  );
}
