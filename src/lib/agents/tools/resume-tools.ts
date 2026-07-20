import 'server-only';

/**
 * 이력서 편집 도구
 * ------------------------------------------------------------------
 * 모든 도구는 `RunContext<AppContext>`의 이력서 정본을 **부분 패치**합니다.
 * LLM은 바뀐 부분만 말하면 되고, 나머지 필드는 코드가 보존합니다.
 *
 * 도구 반환값은 **간결한 스냅샷**입니다. 문서 전체를 돌려주면 매 턴 토큰을
 * 낭비하고 컨텍스트를 밀어내므로, 모델이 다음 질문을 정하는 데 필요한
 * 최소 정보(무엇이 찼고 무엇이 비었는지)만 담습니다.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import {
  upsertListItem,
  removeListItem,
  completeness,
  LIST_SECTIONS,
  type ResumeDocument,
} from '@/lib/resume/schema';
import { ctxOf, type AppContext } from '../context';
import { inlineValue } from '../sanitize';
import { hasFabricatedNumber } from '../fabrication';
import { callJson } from '../openai-client';
import { MODEL_CONFIG } from '../model-config';
import type { RunContext } from '@openai/agents';

/* ────────────────────────────────────────────
   공통 헬퍼
   ──────────────────────────────────────────── */

/**
 * 값을 지우라는 뜻의 센티널.
 *
 * 도구 파라미터는 strict 모드라 모델이 **모든 필드를 매번 보내야** 합니다.
 * 그래서 빈 문자열은 "안 건드림"을 뜻할 수밖에 없고, 그 결과 **필드를 비울
 * 방법이 없었습니다.** "GPA 빼줘", "요약 지워줘" 같은 흔한 요청이 조용히
 * 무시되고, 게다가 도구는 `ok: true`를 돌려줘서 모델이 성공했다고 답했습니다.
 */
export const CLEAR = '__CLEAR__';

/** 도구 설명에 붙일 공통 안내 */
const CLEAR_HINT = ` 값을 비우려면 "${CLEAR}"를 보내세요. 빈 문자열은 "변경 없음"을 뜻합니다.`;

/**
 * "안 건드림"(빈 값)은 제거하고, 센티널은 실제 빈 값으로 바꾼다.
 */
function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === CLEAR) {
      out[k] = '';
      continue;
    }
    if (v === '' || v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      // 배열도 센티널 하나만 담아 보내면 비우기로 해석합니다.
      if (v.length === 1 && v[0] === CLEAR) {
        out[k] = [];
        continue;
      }
      if (v.length === 0) continue;
    }
    out[k] = v;
  }
  return out as Partial<T>;
}

/**
 * 모델에게 돌려줄 간결한 상태 요약.
 * 문서 전체가 아니라 "어디까지 찼는지"만 알려줍니다.
 */
function snapshot(doc: ResumeDocument, note: string): string {
  const c = completeness(doc);
  return JSON.stringify({
    ok: true,
    note,
    completeness: c.percent,
    stillMissing: c.missing,
    canExport: c.isExportable,
    filled: {
      name: doc.basics.name || null,
      email: doc.basics.email || null,
      phone: doc.basics.phone || null,
      links: [doc.basics.linkedin, doc.basics.github, doc.basics.website].filter(Boolean),
      targetRole: doc.targetRole || null,
      education: doc.education.map((e) => ({ id: e.id, school: e.school, degree: e.degree })),
      experience: doc.experience.map((x) => ({
        id: x.id,
        company: x.company,
        title: x.title,
        bulletCount: x.bullets.length,
      })),
      projects: doc.projects.map((p) => ({ id: p.id, name: p.name, bulletCount: p.bullets.length })),
      skills: {
        languages: doc.skills.languages.length,
        frameworks: doc.skills.frameworks.length,
        tools: doc.skills.tools.length,
      },
    },
  });
}

/** 컨텍스트의 이력서를 교체하고 변경 플래그를 세운다 */
function commit(ctx: AppContext, next: ResumeDocument): void {
  ctx.resume = next;
  ctx.resumeTouched = true;
}

type Ctx = RunContext<AppContext> | undefined;

/* ────────────────────────────────────────────
   1. 현재 상태 조회
   ──────────────────────────────────────────── */

export const getResume = tool({
  name: 'get_resume',
  description:
    '저장된 이력서의 **실제 값**이 필요할 때만 호출하세요 (예: 기존 불릿을 수정하려고 원문을 확인할 때). ' +
    '무엇이 채워졌는지 여부는 지시문의 Resume state에 이미 있으니 그것만 보려고 호출하지 마세요 — 불필요한 왕복입니다.',
  parameters: z.object({}),
  execute: async (_input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    return snapshot(ctx.resume, '현재 이력서 상태입니다.');
  },
});

/* ────────────────────────────────────────────
   2. 인적사항 · 목표 직무
   ──────────────────────────────────────────── */

export const setBasics = tool({
  name: 'set_basics',
  description:
    '이름·이메일·전화번호·위치·링크·요약·목표 직무를 저장합니다. 사용자가 알려준 항목만 채우세요.' +
    CLEAR_HINT,
  parameters: z.object({
    name: z.string().max(200).default(''),
    email: z.string().max(200).default(''),
    phone: z.string().max(80).default(''),
    location: z.string().max(200).default('').describe('예: Irvine, CA'),
    linkedin: z.string().max(500).default(''),
    github: z.string().max(500).default(''),
    website: z.string().max(500).default(''),
    summary: z.string().max(1500).default('').describe('선택 사항. 신입은 대개 생략합니다.'),
    targetRole: z
      .string()
      .max(200)
      .default('')
      .describe('지원 목표 직무. ATS 키워드 채점의 기준이 됩니다.'),
  }),
  execute: async (input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    const { targetRole, ...basics } = input;
    const patch = definedOnly(basics);

    // targetRole도 definedOnly를 거쳐야 센티널로 지울 수 있습니다.
    const rolePatch = definedOnly({ targetRole });

    const next: ResumeDocument = {
      ...ctx.resume,
      basics: { ...ctx.resume.basics, ...patch },
      targetRole: 'targetRole' in rolePatch ? (rolePatch.targetRole as string) : ctx.resume.targetRole,
    };
    commit(ctx, next);
    return snapshot(next, '인적사항을 저장했습니다.');
  },
});

/* ────────────────────────────────────────────
   3. 리스트 섹션 (학력 · 경력 · 프로젝트)
   ──────────────────────────────────────────── */

export const upsertEducation = tool({
  name: 'upsert_education',
  description:
    '학력을 추가하거나 수정합니다. 기존 항목을 고칠 때만 id를 주세요. id가 비어 있으면 새 항목이 추가됩니다.' +
    CLEAR_HINT,
  parameters: z.object({
    id: z.string().max(64).default('').describe('수정할 항목의 id. 새로 추가하면 빈 문자열.'),
    school: z.string().max(200).default(''),
    degree: z.string().max(200).default('').describe('예: B.S.'),
    major: z.string().max(200).default(''),
    gpa: z
      .string()
      .max(40)
      .default('')
      .describe(
        '예: 3.8/4.0. 한국 대학은 4.5 만점인 경우가 많으니 반드시 만점을 함께 적으세요 ' +
          '("4.1"만 적으면 미국 채용 담당자에게는 불가능한 값으로 보입니다). ' +
          `낮으면 "${'__CLEAR__'}"로 지우는 편이 낫습니다.`,
      ),
    location: z.string().max(200).default(''),
    startDate: z.string().max(60).default(''),
    endDate: z.string().max(60).default('').describe('졸업 예정일도 가능. 예: Jun 2026'),
  }),
  execute: async (input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    const next = upsertListItem(ctx.resume, 'education', definedOnly(input));
    commit(ctx, next);
    return snapshot(next, '학력을 저장했습니다.');
  },
});

export const upsertExperience = tool({
  name: 'upsert_experience',
  description:
    '경력(인턴십·아르바이트 포함)을 추가하거나 수정합니다. bullets는 "동사 + 정량적 성과" 형태로 작성하세요. ' +
    '⚠️ bullets 배열은 통째로 교체됩니다 — 기존 항목에 하나를 더할 때는 기존 불릿까지 모두 포함해 보내세요.' +
    CLEAR_HINT,
  parameters: z.object({
    id: z.string().max(64).default(''),
    company: z.string().max(200).default(''),
    title: z.string().max(200).default(''),
    location: z.string().max(200).default(''),
    startDate: z.string().max(60).default(''),
    endDate: z.string().max(60).default(''),
    current: z.boolean().default(false).describe('재직 중이면 true — 종료일 대신 Present로 표시'),
    bullets: z.array(z.string().max(600)).max(12).default([]),
  }),
  execute: async (input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    // current는 boolean이라 definedOnly가 지우지 않도록 따로 합칩니다.
    const next = upsertListItem(ctx.resume, 'experience', {
      ...definedOnly(input),
      current: input.current,
    });
    commit(ctx, next);
    return snapshot(next, '경력을 저장했습니다.');
  },
});

export const upsertProject = tool({
  name: 'upsert_project',
  description:
    '프로젝트를 추가하거나 수정합니다. 개인·수업·해커톤 프로젝트 모두 가능합니다. ' +
    '⚠️ bullets와 tech 배열은 통째로 교체됩니다 — 항목을 더할 때는 기존 값까지 모두 포함해 보내세요.' +
    CLEAR_HINT,
  parameters: z.object({
    id: z.string().max(64).default(''),
    name: z.string().max(200).default(''),
    role: z.string().max(200).default(''),
    url: z.string().max(500).default(''),
    tech: z.array(z.string().max(60)).max(40).default([]),
    startDate: z.string().max(60).default(''),
    endDate: z.string().max(60).default(''),
    bullets: z.array(z.string().max(600)).max(12).default([]),
  }),
  execute: async (input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    const next = upsertListItem(ctx.resume, 'projects', definedOnly(input));
    commit(ctx, next);
    return snapshot(next, '프로젝트를 저장했습니다.');
  },
});

export const removeEntry = tool({
  name: 'remove_entry',
  description: '학력·경력·프로젝트 항목을 id로 삭제합니다. 사용자가 명시적으로 요청할 때만 쓰세요.',
  parameters: z.object({
    section: z.enum(LIST_SECTIONS),
    id: z.string().max(64),
  }),
  execute: async (input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    const next = removeListItem(ctx.resume, input.section, input.id);
    commit(ctx, next);
    return snapshot(next, '항목을 삭제했습니다.');
  },
});

/* ────────────────────────────────────────────
   4. 스킬
   ──────────────────────────────────────────── */

export const setSkills = tool({
  name: 'set_skills',
  description:
    '기술 스택을 저장합니다. 각 배열은 통째로 교체되므로, 추가할 때는 기존 항목까지 함께 보내세요.',
  parameters: z.object({
    languages: z.array(z.string().max(60)).max(40).default([]).describe('예: TypeScript, Python'),
    frameworks: z.array(z.string().max(60)).max(40).default([]).describe('예: React, Next.js'),
    tools: z.array(z.string().max(60)).max(40).default([]).describe('예: Git, Docker, AWS'),
    other: z.array(z.string().max(60)).max(40).default([]),
  }),
  execute: async (input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    const next: ResumeDocument = {
      ...ctx.resume,
      skills: { ...ctx.resume.skills, ...definedOnly(input) },
    };
    commit(ctx, next);
    return snapshot(next, '스킬을 저장했습니다.');
  },
});

/* ────────────────────────────────────────────
   5. 불릿 개선 (LLM)
   ──────────────────────────────────────────── */

const ImprovedBulletsSchema = z.object({
  improved: z
    .array(
      z.object({
        original: z.string(),
        rewritten: z.string(),
        why: z.string(),
      }),
    )
    .max(12),
});

export const improveBullets = tool({
  name: 'improve_bullets',
  description:
    '경력·프로젝트 불릿을 채용 담당자에게 잘 읽히도록 다시 씁니다. 정량적 성과를 앞세우고 강한 동사로 시작하게 만듭니다. 결과를 사용자에게 보여주고 동의를 받은 뒤 upsert 도구로 저장하세요.',
  parameters: z.object({
    bullets: z.array(z.string().max(600)).min(1).max(12),
    context: z
      .string()
      .max(400)
      .default('')
      .describe('해당 경력/프로젝트의 배경 (회사, 직무, 사용 기술 등)'),
  }),
  execute: async (input, runContext: Ctx): Promise<string> => {
    const ctx = ctxOf(runContext);
    // 사용자가 채우는 값이므로 프롬프트에 끼워 넣기 전에 정리합니다.
    const role = inlineValue(ctx.resume.targetRole || 'Software Engineer');

    const system = `You rewrite resume bullet points for a candidate targeting: ${role}.

Rules, in priority order:

1. **Never invent numbers, technologies, or achievements.**
   Most bullets you receive have no metric. That is normal and expected.
   When there is no metric, do NOT manufacture one — rewrite the verb and structure
   only, keep the substance identical, and say so in "why".
   (A number the candidate cannot defend in an interview actively harms them.
    A separate code check rejects rewrites containing invented figures.)
2. Start with a strong past-tense action verb (Built, Reduced, Shipped, Owned, Automated...).
3. Only when the original already contains a number may you lead with it —
   in that case apply the XYZ shape: "Accomplished [X] as measured by [Y] by doing [Z]".
- Keep each bullet to one line (roughly 100-160 characters).
- No first-person pronouns. No periods at the end.
- Write in English — resume content is always English even when the conversation is Korean.

Return JSON: { "improved": [ { "original": string, "rewritten": string, "why": string } ] }
"why" must be written in ${ctx.locale === 'en' ? 'English' : 'Korean'} — it is shown to the user.`;

    const payload = JSON.stringify({ context: input.context, bullets: input.bullets });

    const result = await callJson(ImprovedBulletsSchema, system, payload, {
      model: MODEL_CONFIG.fast,
      maxTokens: 1_500,
      signal: ctx.signal,
    });

    /* 날조된 수치가 들어간 재작성본은 **원문으로 되돌립니다.**
     * 모델을 믿는 대신 코드로 검증합니다. */
    let rejected = 0;
    const improved = result.improved.map((item) => {
      if (hasFabricatedNumber(item.original, input.context, item.rewritten)) {
        rejected++;
        return {
          original: item.original,
          rewritten: item.original,
          why:
            ctx.locale === 'en'
              ? 'Kept as-is: the suggested rewrite introduced a number that is not in your original. Tell me the real figure and I will add it.'
              : '원문 유지: 제안된 문장에 원본에 없는 수치가 들어가 있었습니다. 실제 수치를 알려주시면 반영하겠습니다.',
        };
      }
      return item;
    });

    if (rejected > 0) {
      console.warn(`[improve_bullets] 날조된 수치 ${rejected}건을 되돌렸습니다`);
    }

    return JSON.stringify({ improved });
  },
  errorFunction: () =>
    '불릿 개선에 실패했습니다. 원본 불릿을 그대로 사용하거나 잠시 후 다시 시도하세요.',
});

/** Resume Builder가 사용하는 도구 묶음 */
export const RESUME_BUILDER_TOOLS = [
  getResume,
  setBasics,
  upsertEducation,
  upsertExperience,
  upsertProject,
  setSkills,
  removeEntry,
  improveBullets,
];
