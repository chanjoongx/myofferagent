/**
 * 이력서 정본 스키마 (Canonical Resume Document)
 * ------------------------------------------------------------------
 * 이 파일은 이력서 데이터의 **단일 진실 공급원(single source of truth)** 입니다.
 * 에이전트 도구, ATS 채점기, 렌더러(MD/HTML/DOCX), 편집 UI가 모두 이 타입을 공유합니다.
 *
 * 설계 원칙:
 *  1. **모든 필드에 기본값** — 작성 중인 부분 이력서도 항상 유효(valid)합니다.
 *     덕분에 대화 도중 어느 시점에 저장/렌더링해도 깨지지 않습니다.
 *  2. **리스트 항목마다 id** — 패치 도구가 "3번째 경력의 bullets만 수정"처럼
 *     특정 항목을 지목해 수정할 수 있습니다. LLM이 문서 전체를 재직렬화할 필요가 없습니다.
 *  3. **날짜는 자유 문자열** — "2024-06", "Jun 2024", "Present" 모두 허용.
 *     LLM이 채우기 쉽고, 표시용 정규화는 렌더러가 담당합니다.
 */

import { z } from 'zod';

/* ── 길이 제한 ──
 * 프롬프트 인젝션·토큰 폭주 방지를 위한 상한. 넉넉하되 무제한은 아님. */
export const LIMITS = {
  shortText: 200,
  mediumText: 500,
  bullet: 600,
  summary: 1_500,
  maxBullets: 12,
  maxItems: 20,
  maxSkills: 40,
} as const;

/* ── 전역 원칙: 이 스키마는 **절대 실패하지 않는다** ──
 *
 * 예전에는 `.max()`로 길이를 *거부*했습니다. 그런데 `coerceResume`는 검증에
 * 실패하면 빈 이력서를 반환하므로, **필드 하나가 한도를 넘으면 이력서 전체가
 * 날아갔습니다.** 게다가 그 결과가 localStorage에 저장돼 새로고침해도 복구되지
 * 않았습니다.
 *
 * 실제 재현 경로:
 *   - 편집 패널에서 한 경력에 "불릿 추가"를 13번 클릭 (maxBullets = 12)
 *   - 스킬 칸에 쉼표 없이 61자 입력 (토큰 하나가 60자 초과)
 *   - 긴 이력서를 import → LLM이 600자 넘는 불릿을 추출
 *
 * 그래서 한도를 **거부가 아니라 절삭(clamp)** 으로 바꿉니다.
 * 데이터를 조금 잃는 것이 전부를 잃는 것보다 언제나 낫습니다. */

/* ── 제어·서식 문자 제거 ──
 * PDF 추출은 \x0C(폼 피드) 같은 C0 제어 문자를 흘려보내고, 이 값이 그대로
 * docx 렌더러에 들어가면 XML 1.0이 금지하는 문자라 Word가 파일을 손상으로
 * 판정합니다. 방향 제어 문자(U+202E 등)는 내보낸 이력서의 표시 순서를
 * 조작할 수 있습니다. 탭과 줄바꿈만 남기고 걷어냅니다. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS =
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF\uFFFE\uFFFF]/g;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const stripControls = (s: string) =>
  s.replace(/\r\n?/g, '\n').replace(CONTROL_CHARS, '').replace(LONE_SURROGATE, '');

/** 문자열 — 항상 성공. 문자열이 아니면 빈 값, 길면 자른다. */
const text = (max: number) =>
  z.unknown().transform((v) => (typeof v === 'string' ? stripControls(v).trim().slice(0, max) : ''));

/** 문자열 배열 — 항상 성공. 빈 항목 제거 + 개수·길이 절삭. */
const stringList = (maxItems: number, maxLen: number) =>
  z.unknown().transform((v) => {
    if (!Array.isArray(v)) return [];
    return v
      .filter((s): s is string => typeof s === 'string')
      .map((s) => stripControls(s).trim().slice(0, maxLen))
      .filter((s) => s.length > 0)
      .slice(0, maxItems);
  });

/** 불리언 — 항상 성공 */
const bool = () => z.unknown().transform((v) => v === true);

/** 객체 스키마를 항상 성공하도록 감싼다 (객체가 아니면 빈 객체로 취급) */
const obj = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), z.object(shape));

/** 리스트 — 항상 성공. 개수를 절삭하고 각 항목은 항상 파싱된다. */
const list = <T extends z.ZodTypeAny>(item: T, maxItems: number) =>
  z.preprocess(
    (v) =>
      Array.isArray(v)
        ? // 객체가 아닌 원소는 **버립니다.** 예전에는 obj()가 이것들을 `{}`로
          // 바꿔서, `[null, 'x', 42]`가 빈 항목 3개가 됐습니다. 그 빈 항목들이
          // completeness의 "경력/프로젝트 있음" 25점을 그냥 통과시켰습니다.
          v.filter((e) => e !== null && typeof e === 'object' && !Array.isArray(e)).slice(0, maxItems)
        : [],
    z.array(item),
  );

/** 리스트 항목 식별자 — 패치 도구와 편집 UI가 항목을 지목하는 데 사용 */
export function newId(): string {
  // crypto.randomUUID()는 브라우저와 workerd 양쪽에서 사용 가능
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/** 항목 식별자 — 문자열이 아니거나 비어 있으면 새로 발급 */
const idField = z
  .unknown()
  .transform((v) => (typeof v === 'string' && v.length > 0 ? v.slice(0, 64) : newId()));

/* ────────────────────────────────────────────
   섹션 스키마
   ──────────────────────────────────────────── */

export const BasicsSchema = obj({
  name: text(LIMITS.shortText),
  email: text(LIMITS.shortText),
  phone: text(80),
  location: text(LIMITS.shortText),
  linkedin: text(LIMITS.mediumText),
  github: text(LIMITS.mediumText),
  website: text(LIMITS.mediumText),
  /** 선택 사항. 신입/주니어는 보통 생략하는 편이 낫습니다. */
  summary: text(LIMITS.summary),
});

export const EducationSchema = obj({
  id: idField,
  school: text(LIMITS.shortText),
  degree: text(LIMITS.shortText),
  major: text(LIMITS.shortText),
  /** "3.8/4.0" 형태. 낮으면 생략하는 편이 낫습니다(렌더러가 강제하지는 않음). */
  gpa: text(40),
  location: text(LIMITS.shortText),
  startDate: text(60),
  endDate: text(60),
  highlights: stringList(6, LIMITS.bullet),
});

export const ExperienceSchema = obj({
  id: idField,
  company: text(LIMITS.shortText),
  title: text(LIMITS.shortText),
  location: text(LIMITS.shortText),
  startDate: text(60),
  endDate: text(60),
  /** true면 렌더링 시 endDate 대신 "Present" 사용 */
  current: bool(),
  bullets: stringList(LIMITS.maxBullets, LIMITS.bullet),
});

export const ProjectSchema = obj({
  id: idField,
  name: text(LIMITS.shortText),
  role: text(LIMITS.shortText),
  url: text(LIMITS.mediumText),
  tech: stringList(LIMITS.maxSkills, 60),
  startDate: text(60),
  endDate: text(60),
  bullets: stringList(LIMITS.maxBullets, LIMITS.bullet),
});

export const SkillsSchema = obj({
  languages: stringList(LIMITS.maxSkills, 60),
  frameworks: stringList(LIMITS.maxSkills, 60),
  tools: stringList(LIMITS.maxSkills, 60),
  other: stringList(LIMITS.maxSkills, 60),
});

/* ────────────────────────────────────────────
   최상위 문서
   ──────────────────────────────────────────── */

export const ResumeDocumentSchema = obj({
  basics: BasicsSchema,
  education: list(EducationSchema, LIMITS.maxItems),
  experience: list(ExperienceSchema, LIMITS.maxItems),
  projects: list(ProjectSchema, LIMITS.maxItems),
  skills: SkillsSchema,
  /** 지원 목표 직무 — ATS 키워드 채점의 기준이 됩니다. */
  targetRole: text(LIMITS.shortText),
  /** 스키마 진화 대비 버전 태그 */
  version: z.unknown().transform(() => 1 as const),
});

export type Basics = z.infer<typeof BasicsSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Skills = z.infer<typeof SkillsSchema>;
export type ResumeDocument = z.infer<typeof ResumeDocumentSchema>;

/** 리스트 섹션 이름 — 패치 도구와 편집 UI가 공유 */
export const LIST_SECTIONS = ['education', 'experience', 'projects'] as const;
export type ListSection = (typeof LIST_SECTIONS)[number];

/* ────────────────────────────────────────────
   생성 · 병합
   ──────────────────────────────────────────── */

/** 빈 이력서 — 항상 유효한 문서 */
export function emptyResume(): ResumeDocument {
  return ResumeDocumentSchema.parse({});
}

/**
 * 신뢰할 수 없는 입력(클라이언트 body, localStorage)을 안전하게 문서로 복원한다.
 * 실패하면 빈 이력서를 반환 — 절대 throw하지 않는다.
 */
export function coerceResume(input: unknown): ResumeDocument {
  if (input == null) return emptyResume();
  try {
    // `safeParse`는 Zod 검증 실패만 잡습니다. 입력이 던지는 getter를 가졌거나
    // Proxy이거나 Promise면 **프로퍼티를 읽는 순간** 예외가 밖으로 나갑니다.
    // 이 함수는 신뢰할 수 없는 입력(클라이언트 body, localStorage)의 마지막
    // 방어선이므로 어떤 경우에도 던지지 않아야 합니다.
    const parsed = ResumeDocumentSchema.safeParse(input);
    return parsed.success ? parsed.data : emptyResume();
  } catch {
    return emptyResume();
  }
}

/**
 * 부분 패치를 기존 문서에 병합한다.
 *
 * - `basics`/`skills`는 **필드 단위 얕은 병합**: 패치에 없는 필드는 보존됩니다.
 *   (LLM이 이메일만 갱신할 때 이름이 지워지지 않도록)
 * - 리스트 섹션은 호출자가 통째로 넘기며, 개별 항목 수정은 `upsertListItem`을 씁니다.
 */
/** `undefined` 값을 걷어낸다 — 스프레드로 덮어써서 "지움"이 되지 않도록 */
function defined<T extends object>(obj: T | undefined): Partial<T> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export function mergeResume(
  base: ResumeDocument,
  patch: DeepPartial<ResumeDocument>,
): ResumeDocument {
  // 스프레드는 `undefined` 값을 가진 키도 복사하므로, 그대로 두면
  // `{ targetRole: undefined }`가 기존 값을 지워 버립니다
  // ("패치에 없는 필드는 보존한다"는 이 함수의 계약과 어긋납니다).
  const merged = {
    ...base,
    ...defined(patch),
    basics: { ...base.basics, ...defined(patch.basics) },
    skills: { ...base.skills, ...defined(patch.skills) },
    education: patch.education ?? base.education,
    experience: patch.experience ?? base.experience,
    projects: patch.projects ?? base.projects,
  };
  return coerceResume(merged);
}

/**
 * 리스트 섹션에 항목을 추가하거나(id 없음) 기존 항목을 수정한다(id 일치).
 * 반환값은 항상 새 문서 — 원본은 변경하지 않습니다.
 */
export function upsertListItem(
  doc: ResumeDocument,
  section: ListSection,
  item: Record<string, unknown>,
): ResumeDocument {
  const list = doc[section] as Array<{ id: string }>;
  // idField가 64자로 자르므로 조회도 같은 규칙으로 해야 합니다.
  // (안 그러면 긴 id로 수정 요청 시 매칭에 실패해 항목이 하나 더 생깁니다.)
  const id = typeof item.id === 'string' ? item.id.slice(0, 64) : '';
  const idx = id ? list.findIndex((entry) => entry.id === id) : -1;

  // `undefined` 값을 걷어냅니다 — 스프레드로 덮어쓰면 저장된 값이 지워집니다.
  const patch = defined(item);

  const next =
    idx >= 0
      ? list.map((entry, i) => (i === idx ? { ...entry, ...patch } : entry))
      : [...list, { ...patch, id: id || newId() }];

  return coerceResume({ ...doc, [section]: next });
}

/* ────────────────────────────────────────────
   3-way 병합
   ──────────────────────────────────────────── */

/** 값이 실질적으로 같은지 — 배열/객체는 구조 비교 */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/** 필드 단위 선택: 사용자가 바꿨으면 사용자 값, 아니면 서버 값 */
function pick<T extends Record<string, unknown>>(base: T, ours: T, theirs: T): T {
  const out = { ...theirs };
  for (const key of Object.keys(ours) as Array<keyof T>) {
    if (!same(ours[key], base[key])) out[key] = ours[key];
  }
  return out;
}

/**
 * 응답이 도착하는 동안 사용자가 편집 패널에서 고친 내용을 보존하며 병합한다.
 *
 * - `base`   요청을 보낼 때의 문서
 * - `ours`   지금 클라이언트의 문서 (스트리밍 중 사용자가 고쳤을 수 있음)
 * - `theirs` 서버가 도구로 패치해 돌려준 문서
 *
 * 규칙은 하나입니다: **사용자가 base에서 바꾼 필드는 사용자 것이 이깁니다.**
 * 나머지는 서버 값을 씁니다.
 *
 * 이 함수가 없으면 서버 응답이 사용자의 진행 중 편집을 통째로 덮어씁니다.
 * (20~40초 걸리는 턴 동안 패널에서 오타를 고치는 것은 아주 흔한 행동입니다.)
 */
export function threeWayMerge(
  base: ResumeDocument,
  ours: ResumeDocument,
  theirs: ResumeDocument,
): ResumeDocument {
  const mergeList = (section: ListSection) => {
    const baseById = new Map(base[section].map((e) => [e.id, e as Record<string, unknown>]));
    const oursById = new Map(ours[section].map((e) => [e.id, e as Record<string, unknown>]));
    const theirsById = new Map(theirs[section].map((e) => [e.id, e as Record<string, unknown>]));

    const merged: Array<Record<string, unknown>> = [];

    // 서버가 돌려준 순서를 기준으로 삼되, 사용자가 바꾼 필드를 덮어씌웁니다.
    for (const [id, theirItem] of theirsById) {
      const ourItem = oursById.get(id);
      const baseItem = baseById.get(id);

      // 사용자가 스트리밍 도중 **삭제한** 항목은 되살리지 않습니다.
      // (base에 있었는데 ours에 없다 = 사용자가 지웠다)
      if (!ourItem && baseItem) continue;

      merged.push(
        ourItem && baseItem ? pick(baseItem, ourItem, theirItem) : (ourItem ?? theirItem),
      );
    }

    // 스트리밍 도중 사용자가 직접 추가한 항목은 서버가 모르므로 뒤에 붙입니다.
    for (const [id, ourItem] of oursById) {
      if (!theirsById.has(id) && !baseById.has(id)) merged.push(ourItem);
    }

    return merged;
  };

  return coerceResume({
    basics: pick(
      base.basics as unknown as Record<string, unknown>,
      ours.basics as unknown as Record<string, unknown>,
      theirs.basics as unknown as Record<string, unknown>,
    ),
    skills: pick(
      base.skills as unknown as Record<string, unknown>,
      ours.skills as unknown as Record<string, unknown>,
      theirs.skills as unknown as Record<string, unknown>,
    ),
    targetRole: same(ours.targetRole, base.targetRole) ? theirs.targetRole : ours.targetRole,
    education: mergeList('education'),
    experience: mergeList('experience'),
    projects: mergeList('projects'),
    version: 1,
  });
}

/** 리스트 섹션에서 id로 항목을 제거한다. */
export function removeListItem(
  doc: ResumeDocument,
  section: ListSection,
  id: string,
): ResumeDocument {
  const list = doc[section] as Array<{ id: string }>;
  return coerceResume({ ...doc, [section]: list.filter((entry) => entry.id !== id) });
}

/* ────────────────────────────────────────────
   완성도
   ──────────────────────────────────────────── */

export interface CompletenessResult {
  /** 0–100 */
  percent: number;
  /** 아직 채워지지 않은 필수 항목의 i18n 키 */
  missing: string[];
  /** 다운로드 가능한 최소 요건 충족 여부 */
  isExportable: boolean;
}

/**
 * 이력서 완성도를 계산한다 (규칙 기반, LLM 없음).
 * 편집 패널의 진행률 게이지와 Builder 에이전트의 "다음 질문" 판단에 쓰입니다.
 */
export function completeness(doc: ResumeDocument): CompletenessResult {
  const checks: Array<{ key: string; ok: boolean; weight: number }> = [
    { key: 'resume.field.name', ok: doc.basics.name.length > 0, weight: 15 },
    { key: 'resume.field.email', ok: doc.basics.email.length > 0, weight: 15 },
    { key: 'resume.field.phone', ok: doc.basics.phone.length > 0, weight: 5 },
    {
      key: 'resume.field.links',
      ok: doc.basics.linkedin.length > 0 || doc.basics.github.length > 0,
      weight: 5,
    },
    { key: 'resume.field.education', ok: doc.education.length > 0, weight: 15 },
    {
      key: 'resume.field.experienceOrProjects',
      ok: doc.experience.length > 0 || doc.projects.length > 0,
      weight: 25,
    },
    {
      key: 'resume.field.bullets',
      ok: [...doc.experience, ...doc.projects].some((e) => e.bullets.length > 0),
      weight: 10,
    },
    {
      key: 'resume.field.skills',
      ok:
        doc.skills.languages.length +
          doc.skills.frameworks.length +
          doc.skills.tools.length >
        0,
      weight: 5,
    },
    { key: 'resume.field.targetRole', ok: doc.targetRole.length > 0, weight: 5 },
  ];

  const earned = checks.reduce((sum, c) => (c.ok ? sum + c.weight : sum), 0);
  const missing = checks.filter((c) => !c.ok).map((c) => c.key);

  return {
    percent: Math.round(earned),
    missing,
    // 이름 + 연락 수단 + 내용(경력/프로젝트/학력) 중 하나는 있어야 내보내기 허용
    isExportable:
      doc.basics.name.length > 0 &&
      doc.basics.email.length > 0 &&
      doc.education.length + doc.experience.length + doc.projects.length > 0,
  };
}

/**
 * 누락 항목 키를 사람이 읽는 영어 라벨로 바꾼다.
 *
 * `completeness().missing`은 UI용 i18n 키(`resume.field.phone`)를 돌려줍니다.
 * 그 값이 에이전트 지시문과 도구 응답에 **그대로 주입되고 있었습니다** —
 * 모델에게 `resume.field.experienceOrProjects`는 의미 없는 문자열입니다.
 */
const MISSING_LABELS: Record<string, string> = {
  'resume.field.name': 'name',
  'resume.field.email': 'email',
  'resume.field.phone': 'phone number',
  'resume.field.links': 'LinkedIn or GitHub link',
  'resume.field.education': 'education',
  'resume.field.experienceOrProjects': 'work experience or projects',
  'resume.field.bullets': 'achievement bullets',
  'resume.field.skills': 'skills',
  'resume.field.targetRole': 'target role',
};

export function describeMissing(missing: string[]): string[] {
  return missing.map((key) => MISSING_LABELS[key] ?? key);
}

/** 문서가 사실상 비어 있는지 (환영 화면 분기용) */
export function isEmptyResume(doc: ResumeDocument): boolean {
  return (
    doc.basics.name.length === 0 &&
    doc.basics.email.length === 0 &&
    doc.education.length === 0 &&
    doc.experience.length === 0 &&
    doc.projects.length === 0
  );
}

/* ────────────────────────────────────────────
   유틸 타입
   ──────────────────────────────────────────── */

export type DeepPartial<T> = T extends Array<infer U>
  ? Array<U>
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;
