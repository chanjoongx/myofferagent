'use client';

/**
 * 이력서 편집 패널
 * ------------------------------------------------------------------
 * 대화 옆에서 이력서 정본을 **실시간으로 보여주고 직접 고칠 수 있게** 합니다.
 *
 * 이전에는 이력서가 채팅 말풍선 안의 마크다운 덩어리로만 존재해서,
 * 오타 하나를 고치려 해도 에이전트에게 다시 말해야 했습니다.
 * 여기서 고친 내용은 다음 턴에 그대로 에이전트에게 전달됩니다.
 */

import { useState, useCallback } from 'react';
import {
  Download,
  FileText,
  FileType,
  Braces,
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  Trash,
} from 'lucide-react';
import EditableText from './EditableText';
import { useLanguage } from '@/lib/i18n-context';
import { useToast } from '@/components/ui/Toast';
import { exportResume, type ExportFormat } from '@/lib/resume/export';
import type { ResumeDocument, ListSection, CompletenessResult } from '@/lib/resume/schema';

interface ResumePanelProps {
  doc: ResumeDocument;
  /** 이력서를 비우고 localStorage에서도 삭제 */
  reset: () => void;
  completeness: CompletenessResult;
  setBasicsField: (field: keyof ResumeDocument['basics'], value: string) => void;
  patch: (partial: Partial<ResumeDocument>) => void;
  upsertItem: (section: ListSection, item: Record<string, unknown>) => void;
  removeItem: (section: ListSection, id: string) => void;
}

/* ────────────────────────────────────────────
   완성도 게이지
   ──────────────────────────────────────────── */

function CompletenessBar({ percent }: { percent: number }) {
  const tone =
    percent >= 80 ? 'bg-accent' : percent >= 50 ? 'bg-yellow-400' : 'bg-orange-400';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-border">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-text-secondary">{percent}%</span>
    </div>
  );
}

/* ────────────────────────────────────────────
   섹션 래퍼
   ──────────────────────────────────────────── */

function Section({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between border-b border-surface-border pb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
          {title}
        </h3>
        {onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-text-secondary transition-colors hover:bg-accent/10 hover:text-accent"
            aria-label={addLabel}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** 항목 카드 — 삭제 버튼 포함 */
function EntryCard({
  onRemove,
  removeLabel,
  children,
}: {
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative rounded-lg border border-transparent p-2 transition-colors hover:border-surface-border hover:bg-surface/30">
      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded p-1 text-text-secondary/40 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
        aria-label={removeLabel}
      >
        <Trash2 className="h-3 w-3" />
      </button>
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────
   불릿 편집
   ──────────────────────────────────────────── */

function BulletEditor({
  bullets,
  onChange,
  label,
}: {
  bullets: string[];
  onChange: (next: string[]) => void;
  label: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="mt-1 space-y-0.5">
      {bullets.map((b, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span aria-hidden className="mt-[7px] text-[10px] text-text-secondary/50">
            •
          </span>
          <EditableText
            value={b}
            onChange={(v) => onChange(bullets.map((old, j) => (j === i ? v : old)))}
            multiline
            ariaLabel={`${label} ${i + 1}`}
            className="text-[12px] leading-snug"
          />
          <button
            onClick={() => onChange(bullets.filter((_, j) => j !== i))}
            className="mt-1 rounded p-0.5 text-text-secondary/30 transition-colors hover:text-red-400"
            aria-label={t('resume.removeBullet')}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...bullets, ''])}
        className="ml-3 inline-flex items-center gap-1 text-[11px] text-text-secondary/60 transition-colors hover:text-accent"
      >
        <Plus className="h-2.5 w-2.5" />
        {t('resume.addBullet')}
      </button>
    </div>
  );
}

/** 쉼표 구분 목록 편집 (스킬용) */
function CsvField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="w-20 shrink-0 pt-1 text-text-secondary">{label}</span>
      <EditableText
        value={values.join(', ')}
        onChange={(v) =>
          onChange(
            v
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        multiline
        ariaLabel={label}
        className="text-[12px] leading-snug"
      />
    </div>
  );
}

/* ────────────────────────────────────────────
   메인 패널
   ──────────────────────────────────────────── */

const EXPORT_BUTTONS: Array<{ format: ExportFormat; icon: typeof Download; label: string }> = [
  { format: 'pdf', icon: FileText, label: 'PDF' },
  { format: 'docx', icon: FileType, label: 'DOCX' },
  { format: 'md', icon: Download, label: 'MD' },
  { format: 'json', icon: Braces, label: 'JSON' },
];

export default function ResumePanel({
  doc,
  reset,
  completeness,
  setBasicsField,
  patch,
  upsertItem,
  removeItem,
}: ResumePanelProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!completeness.isExportable) {
        toast(t('resume.exportBlocked'), 'error');
        return;
      }
      setBusy(format);
      try {
        await exportResume(doc, format);
      } catch (err) {
        console.error('[export]', err);
        toast(t('resume.exportFailed'), 'error');
      } finally {
        setBusy(null);
      }
    },
    [doc, completeness.isExportable, toast, t],
  );

  return (
    <div className="flex h-full flex-col">
      {/* ── 헤더 ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('resume.title')}</h2>
        <CompletenessBar percent={completeness.percent} />
      </div>

      {/* ── 본문 ── */}
      <div className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* 인적사항 */}
        <div className="space-y-1">
          <EditableText
            value={doc.basics.name}
            onChange={(v) => setBasicsField('name', v)}
            placeholder={t('resume.field.name')}
            ariaLabel={t('resume.field.name')}
            className="text-lg font-bold"
          />
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[12px] text-text-secondary">
            {(
              [
                ['email', t('resume.field.email')],
                ['phone', t('resume.field.phone')],
                ['location', t('resume.field.location')],
                ['linkedin', 'LinkedIn'],
                ['github', 'GitHub'],
                ['website', t('resume.field.website')],
              ] as const
            ).map(([field, label]) => (
              <EditableText
                key={field}
                value={doc.basics[field]}
                onChange={(v) => setBasicsField(field, v)}
                placeholder={label}
                ariaLabel={label}
                className="text-[12px]"
              />
            ))}
          </div>
        </div>

        {/* 목표 직무 */}
        <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1.5">
          <span className="shrink-0 text-[11px] font-medium text-accent">
            {t('resume.field.targetRole')}
          </span>
          <EditableText
            value={doc.targetRole}
            onChange={(v) => patch({ targetRole: v })}
            placeholder={t('resume.targetRolePlaceholder')}
            ariaLabel={t('resume.field.targetRole')}
            className="text-[12px]"
          />
        </div>

        {/* 학력 */}
        <Section
          title={t('resume.section.education')}
          onAdd={() => upsertItem('education', { school: '' })}
          addLabel={t('resume.addEntry')}
        >
          {doc.education.map((e) => (
            <EntryCard
              key={e.id}
              onRemove={() => removeItem('education', e.id)}
              removeLabel={t('resume.removeEntry')}
            >
              <EditableText
                value={e.school}
                onChange={(v) => upsertItem('education', { id: e.id, school: v })}
                placeholder={t('resume.field.school')}
                ariaLabel={t('resume.field.school')}
                className="pr-6 text-[13px] font-semibold"
              />
              <div className="grid grid-cols-2 gap-x-2 text-[12px] text-text-secondary">
                <EditableText
                  value={e.degree}
                  onChange={(v) => upsertItem('education', { id: e.id, degree: v })}
                  placeholder={t('resume.field.degree')}
                  ariaLabel={t('resume.field.degree')}
                  className="text-[12px]"
                />
                <EditableText
                  value={e.major}
                  onChange={(v) => upsertItem('education', { id: e.id, major: v })}
                  placeholder={t('resume.field.major')}
                  ariaLabel={t('resume.field.major')}
                  className="text-[12px]"
                />
                <EditableText
                  value={e.startDate}
                  onChange={(v) => upsertItem('education', { id: e.id, startDate: v })}
                  placeholder={t('resume.field.startDate')}
                  ariaLabel={t('resume.field.startDate')}
                  className="text-[12px]"
                />
                <EditableText
                  value={e.endDate}
                  onChange={(v) => upsertItem('education', { id: e.id, endDate: v })}
                  placeholder={t('resume.field.endDate')}
                  ariaLabel={t('resume.field.endDate')}
                  className="text-[12px]"
                />
                <EditableText
                  value={e.gpa}
                  onChange={(v) => upsertItem('education', { id: e.id, gpa: v })}
                  placeholder="GPA"
                  ariaLabel="GPA"
                  className="text-[12px]"
                />
              </div>
            </EntryCard>
          ))}
        </Section>

        {/* 경력 */}
        <Section
          title={t('resume.section.experience')}
          onAdd={() => upsertItem('experience', { company: '' })}
          addLabel={t('resume.addEntry')}
        >
          {doc.experience.map((x) => (
            <EntryCard
              key={x.id}
              onRemove={() => removeItem('experience', x.id)}
              removeLabel={t('resume.removeEntry')}
            >
              <EditableText
                value={x.title}
                onChange={(v) => upsertItem('experience', { id: x.id, title: v })}
                placeholder={t('resume.field.title')}
                ariaLabel={t('resume.field.title')}
                className="pr-6 text-[13px] font-semibold"
              />
              <div className="grid grid-cols-2 gap-x-2 text-[12px] text-text-secondary">
                <EditableText
                  value={x.company}
                  onChange={(v) => upsertItem('experience', { id: x.id, company: v })}
                  placeholder={t('resume.field.company')}
                  ariaLabel={t('resume.field.company')}
                  className="text-[12px]"
                />
                <EditableText
                  value={x.location}
                  onChange={(v) => upsertItem('experience', { id: x.id, location: v })}
                  placeholder={t('resume.field.location')}
                  ariaLabel={t('resume.field.location')}
                  className="text-[12px]"
                />
                <EditableText
                  value={x.startDate}
                  onChange={(v) => upsertItem('experience', { id: x.id, startDate: v })}
                  placeholder={t('resume.field.startDate')}
                  ariaLabel={t('resume.field.startDate')}
                  className="text-[12px]"
                />
                {/* 재직 중이면 값이 아니라 placeholder로 "현재"를 보여줍니다.
                    값으로 넣으면 첫 타건에 번역된 단어가 endDate에 저장됐습니다. */}
                <EditableText
                  value={x.current ? '' : x.endDate}
                  onChange={(v) => upsertItem('experience', { id: x.id, endDate: v, current: false })}
                  placeholder={x.current ? t('resume.present') : t('resume.field.endDate')}
                  ariaLabel={t('resume.field.endDate')}
                  className="text-[12px]"
                />
              </div>
              <BulletEditor
                bullets={x.bullets}
                onChange={(next) => upsertItem('experience', { id: x.id, bullets: next })}
                label={t('resume.bullet')}
              />
            </EntryCard>
          ))}
        </Section>

        {/* 프로젝트 */}
        <Section
          title={t('resume.section.projects')}
          onAdd={() => upsertItem('projects', { name: '' })}
          addLabel={t('resume.addEntry')}
        >
          {doc.projects.map((p) => (
            <EntryCard
              key={p.id}
              onRemove={() => removeItem('projects', p.id)}
              removeLabel={t('resume.removeEntry')}
            >
              <EditableText
                value={p.name}
                onChange={(v) => upsertItem('projects', { id: p.id, name: v })}
                placeholder={t('resume.field.projectName')}
                ariaLabel={t('resume.field.projectName')}
                className="pr-6 text-[13px] font-semibold"
              />
              <div className="grid grid-cols-2 gap-x-2 text-[12px] text-text-secondary">
                <EditableText
                  value={p.tech.join(', ')}
                  onChange={(v) =>
                    upsertItem('projects', {
                      id: p.id,
                      tech: v.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder={t('resume.field.tech')}
                  ariaLabel={t('resume.field.tech')}
                  className="text-[12px]"
                />
                <EditableText
                  value={p.url}
                  onChange={(v) => upsertItem('projects', { id: p.id, url: v })}
                  placeholder="URL"
                  ariaLabel="URL"
                  className="text-[12px]"
                />
              </div>
              <BulletEditor
                bullets={p.bullets}
                onChange={(next) => upsertItem('projects', { id: p.id, bullets: next })}
                label={t('resume.bullet')}
              />
            </EntryCard>
          ))}
        </Section>

        {/* 스킬 */}
        <Section title={t('resume.section.skills')}>
          <div className="space-y-1">
            {(
              [
                ['languages', t('resume.skills.languages')],
                ['frameworks', t('resume.skills.frameworks')],
                ['tools', t('resume.skills.tools')],
              ] as const
            ).map(([key, label]) => (
              <CsvField
                key={key}
                label={label}
                values={doc.skills[key]}
                onChange={(next) => patch({ skills: { ...doc.skills, [key]: next } })}
              />
            ))}
          </div>
        </Section>

        {/* 미완성 안내 */}
        {completeness.missing.length > 0 && (
          <div className="rounded-lg border border-surface-border bg-surface/40 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
              <ChevronDown className="h-3 w-3" />
              {t('resume.missingTitle')}
            </div>
            <div className="flex flex-wrap gap-1">
              {completeness.missing.map((key) => (
                <span
                  key={key}
                  className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-400"
                >
                  {t(key)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 내보내기 ── */}
      <div className="shrink-0 space-y-1.5 border-t border-surface-border p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {EXPORT_BUTTONS.map(({ format, icon: Icon, label }) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={busy !== null || !completeness.isExportable}
              title={!completeness.isExportable ? t('resume.exportBlocked') : label}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-surface-border bg-surface-elevated px-2 py-1.5 text-[11px] font-medium transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy === format ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              {label}
            </button>
          ))}
        </div>

        {/* 이력서 삭제 —
            이력서는 브라우저 localStorage에 남습니다. 공용 PC에서 쓰는 사용자가
            자기 PII를 지울 수단이 반드시 있어야 합니다. */}
        <button
          onClick={() => {
            if (window.confirm(t('resume.clearConfirm'))) reset();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[11px] text-text-secondary/60 transition-colors hover:border-red-500/30 hover:text-red-400"
        >
          <Trash className="h-3 w-3" />
          {t('resume.clear')}
        </button>
      </div>
    </div>
  );
}
