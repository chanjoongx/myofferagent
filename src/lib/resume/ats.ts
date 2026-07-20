/**
 * ATS 채점 — 규칙 기반 + LLM 하이브리드
 * ------------------------------------------------------------------
 * 기존 구현은 100점 전부를 LLM 한 번의 판단에 맡겼습니다. 그래서
 *  - 같은 이력서를 두 번 넣으면 점수가 달라지고,
 *  - 왜 그 점수인지 설명할 수 없고,
 *  - "정량적 성과가 있는가" 같은 **코드로 셀 수 있는 것**까지 추측했습니다.
 *
 * 여기서는 역할을 나눕니다:
 *
 *  | 섹션                    | 배점 | 방식      | 이유                          |
 *  |-------------------------|-----|-----------|-------------------------------|
 *  | formatCompatibility     | 20  | 규칙      | 구조에서 바로 확인 가능        |
 *  | structuralCompleteness  | 15  | 규칙      | 섹션 존재 여부는 셀 수 있음    |
 *  | achievementQuality      | 20  | 규칙      | 숫자·동사는 패턴으로 검출      |
 *  | readability             | 10  | 규칙      | 길이·일관성은 계산 가능        |
 *  | keywordOptimization     | 25  | LLM       | 직무 의미 이해가 필요          |
 *  | grammar                 | 10  | LLM       | 언어 판단이 필요               |
 *
 * 규칙 부분(65점)은 결정론적이고 무료이며 단위 테스트가 가능합니다.
 * LLM은 정말로 판단이 필요한 35점만 맡습니다.
 */

import type { ATSAnalysis } from '@/lib/types';
import type { ResumeDocument } from './schema';

/* ────────────────────────────────────────────
   패턴
   ──────────────────────────────────────────── */

/* ────────────────────────────────────────────
   정량적 성과 감지
   ────────────────────────────────────────────
 * ⚠️ 예전 패턴은 `\b\d{2,}\b`에 의존했습니다. 숫자 뒤에 단어 경계를 요구하기
 * 때문에 **단위가 붙은 수치를 전부 놓쳤습니다** — 240ms, 90ms, 500GB, 3TB.
 * 백엔드 이력서에서 가장 흔한 성과 표기가 통째로 빠진 셈입니다.
 * 반대로 연도(2025)와 버전(Java 17)은 성과로 **잘못 세었습니다.**
 *
 * 그래서 (a) 성과가 아닌 숫자를 먼저 제거하고 (b) 단위·대상이 붙은 수치를
 * 명시적으로 인정합니다. */

/** 성과가 아닌 숫자: 연도, 버전 문자열, "기술명 + 숫자" */
const NOT_A_METRIC = new RegExp(
  [
    String.raw`\b(?:19|20)\d{2}\b`,
    String.raw`\bv\d+(?:\.\d+)*\b`,
    String.raw`\b\d+\.\d+(?:\.\d+)+\b`,
    String.raw`\b(?:java|python|node(?:\.js)?|react|angular|vue|next(?:\.js)?|spring(?:\s+boot)?|django|flask|rails|php|ruby|golang|go|\.net|dotnet|c\+\+|es|http|tls|ssl|ipv|android|ios|macos|ubuntu|postgres(?:ql)?|mysql|redis|kafka|kubernetes|k8s|jdk|jvm)\s*v?\d+(?:\.\d+)*\b`,
  ].join('|'),
  'gi',
);

/** 수치에 붙는 단위 */
const UNIT =
  String.raw`ms|s|sec|secs|seconds?|min|mins|minutes?|hrs?|hours?|days?|weeks?|months?|gb|mb|kb|tb|qps|rps|tps|fps|loc`;

/** 세는 대상 — "8 endpoints", "5 engineers" */
const COUNTED = String.raw`users?|customers?|engineers?|developers?|interns?|members?|students?|teams?|people|records?|rows?|requests?|queries|endpoints?|apis?|services?|tests?|bugs?|defects?|features?|projects?|repos?|commits?|prs?|contributors?|clients?|sprints?|semesters?|countries|languages?|locales?|models?|datasets?|pages?|components?|tables?|jobs?`;

const QUANTIFIER = new RegExp(
  [
    String.raw`\d+(?:\.\d+)?\s*(?:%|percent|퍼센트|×|배)`,
    String.raw`\d+(?:\.\d+)?\s*x\b`,
    String.raw`[$₩€£]\s*\d`,
    String.raw`\b\d+(?:\.\d+)?\s*(?:k|m|bn|million|billion|만|억)\b`,
    String.raw`\b\d+(?:\.\d+)?\s*(?:${UNIT})\b`,
    String.raw`\b\d+(?:st|nd|rd|th)\b`,
    String.raw`\b\d+\s+(?:[a-z][\w-]*\s+)?(?:${COUNTED})\b`,
    String.raw`\b\d{2,}\b`,
  ].join('|'),
  'i',
);

/** 불릿에 방어 가능한 수치가 있는가 */
export function hasQuantity(text: string): boolean {
  return QUANTIFIER.test(text.replace(NOT_A_METRIC, ' '));
}

/* ────────────────────────────────────────────
   동사 강도
   ────────────────────────────────────────────
 * ⚠️ 예전에는 63개짜리 허용 목록을 썼습니다. 목록에 없는 좋은 동사
 * (Wrote, Owned, Mentored, Containerized, Benchmarked, Won…)를 전부 감점했고,
 * 실제로 잘 쓴 이력서의 **최고 불릿들이 "약한 불릿"으로 사용자에게 표시**됐습니다.
 * 허용 목록은 언제나 구멍이 납니다. 형태론 + 약한 동사 차단으로 바꿉니다. */

/** 동사이긴 하지만 이력서에서는 약한 표현 */
const WEAK_VERBS = new Set([
  'worked','helped','assisted','participated','attended','involved','responsible',
  'used','utilized','learned','studied','tried','handled','dealt','performed',
  'supported','maintained','communicated','interacted','familiarized','exposed',
  'contributed','joined','followed','observed','shadowed',
]);

/** -ed로 끝나지 않는 강한 과거형 동사 */
const IRREGULAR_PAST = new Set([
  'built','wrote','led','drove','rebuilt','won','ran','began','chose','cut','set',
  'sent','spent','taught','brought','found','held','kept','met','oversaw','rewrote',
  'sped','split','took','grew','drew','beat','shipped','made','broke','rose','saw',
]);

/** 강한 동사로 시작하는가 (형태론 기반) */
export function isStrongVerb(word: string): boolean {
  if (!word) return false;
  if (WEAK_VERBS.has(word)) return false;
  if (IRREGULAR_PAST.has(word)) return true;
  // 규칙 과거형: 5자 이상 + -ed
  return word.length >= 5 && word.endsWith('ed');
}

/* ── 1인칭 대명사 ── */
/** `I/O`는 1인칭이 아닙니다 — 먼저 걷어냅니다. */
const NON_PRONOUN = /\bI\/O\b/gi;
const FIRST_PERSON_RE = /\b(i|my|me|we|our|us)\b/i;

export function hasFirstPerson(text: string): boolean {
  return FIRST_PERSON_RE.test(text.replace(NON_PRONOUN, ' '));
}

/** 미국 이력서에 있으면 안 되는 개인정보 (한국 이력서 관행에서 넘어오는 항목) */
const KOREAN_RESUME_LEAKAGE =
  /\b(date of birth|d\.?o\.?b\.?|gender|marital status|nationality)\b|생년월일|성별|결혼|주민등록/i;

/** 만점 표기 없는 GPA — "4.1"만 적으면 미국 기준으로는 불가능한 값 */
const BARE_GPA = /^\s*\d(?:\.\d+)?\s*$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 권장 불릿 길이 (문자 수) */
const BULLET_MIN = 40;
const BULLET_MAX = 180;

/* ────────────────────────────────────────────
   헬퍼
   ──────────────────────────────────────────── */

/**
 * **성과 주장**에 해당하는 불릿만 모은다.
 *
 * ⚠️ 학력의 highlights는 제외합니다. 신입이 거기 적는 것은 대개
 * "Relevant Coursework: Data Structures, Algorithms" 또는 "Dean's List"인데,
 * 이건 동사로 시작할 이유도 수치를 담을 이유도 없습니다.
 * 예전에는 이것까지 성과 불릿으로 세어 **모든 신입이 이중으로 감점**됐습니다.
 */
function achievementBullets(doc: ResumeDocument): string[] {
  return [...doc.experience.flatMap((x) => x.bullets), ...doc.projects.flatMap((p) => p.bullets)];
}

/** 가독성 평가 대상 — 학력 highlights 포함 (길이 하한은 면제) */
function allBullets(doc: ResumeDocument): string[] {
  return [...achievementBullets(doc), ...doc.education.flatMap((e) => e.highlights)];
}

function firstWord(s: string): string {
  return (s.trim().split(/[\s,]+/)[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

/** 0..max 범위로 비율을 점수화 */
function scale(ratio: number, max: number): number {
  return Math.round(Math.max(0, Math.min(1, ratio)) * max * 10) / 10;
}

/** 대략적인 단어 수 — 1페이지 분량 판정용 */
function wordCount(doc: ResumeDocument): number {
  const parts = [
    doc.basics.summary,
    ...allBullets(doc),
    ...doc.skills.languages,
    ...doc.skills.frameworks,
    ...doc.skills.tools,
  ];
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}

/* ────────────────────────────────────────────
   규칙 기반 채점 (65점)
   ──────────────────────────────────────────── */

export interface RuleScores {
  formatCompatibility: { score: number; maxScore: 20; issues: string[]; suggestions: string[] };
  structuralCompleteness: { score: number; maxScore: 15; present: string[]; missing: string[] };
  achievementQuality: { score: number; maxScore: 20; weakBullets: string[]; improved: string[] };
  readability: { score: number; maxScore: 10; issues: string[] };
}

export function scoreRules(doc: ResumeDocument): RuleScores {
  const bullets = allBullets(doc);
  const issues: string[] = [];
  const suggestions: string[] = [];

  /* ── formatCompatibility (20) ──
   * 이 앱은 이력서를 자체 렌더러로 출력하므로 레이아웃 위험(다단·표·머리말)은
   * 구조적으로 0입니다. 그래서 배점은 **사용자 데이터에 달린 부분**에 둡니다. */
  let format = 0;

  if (doc.basics.name) format += 3;
  else issues.push('이름이 없습니다 — ATS가 지원자를 식별하지 못합니다');

  if (EMAIL_RE.test(doc.basics.email)) {
    format += 4;
  } else if (doc.basics.email) {
    issues.push(`이메일 형식이 올바르지 않습니다: ${doc.basics.email}`);
  } else {
    issues.push('이메일이 없습니다 — 연락 수단은 필수입니다');
  }

  if (doc.basics.phone || doc.basics.location) format += 2;
  else suggestions.push('전화번호 또는 거주 지역을 추가하세요');

  if (doc.basics.linkedin || doc.basics.github) format += 3;
  else suggestions.push('LinkedIn 또는 GitHub 링크를 추가하세요');

  // 1페이지 분량 (신입·주니어 기준)
  const words = wordCount(doc);
  if (words === 0) {
    issues.push('내용이 비어 있습니다');
  } else if (words <= 250) {
    format += 5;
  } else if (words <= 350) {
    format += 3;
    suggestions.push(`분량이 다소 많습니다(약 ${words} 단어) — 1페이지로 줄이세요`);
  } else {
    format += 1;
    issues.push(`분량이 1페이지를 넘습니다(약 ${words} 단어) — 신입은 1페이지가 표준입니다`);
  }

  /* 예전에는 여기서 "표준 섹션 헤더"를 이유로 3점을 **무조건** 줬습니다.
   * 렌더러가 보장하는 값이라 모든 이력서가 똑같이 받았고, 정보량이 0이었습니다.
   * 대신 이 사용자층에서 실제로 갈리는 두 가지를 봅니다. */

  // (a) 한국 이력서 관행이 그대로 넘어왔는가 — 미국에서는 차별 이슈가 됩니다.
  const scanned = [doc.basics.summary, ...allBullets(doc)].join(' ');
  if (KOREAN_RESUME_LEAKAGE.test(scanned)) {
    issues.push('생년월일·성별·결혼 여부·국적은 미국 이력서에서 반드시 빼야 합니다 (차별 이슈)');
  } else {
    format += 2;
  }

  // (b) GPA에 만점 표기가 있는가 — 한국 대학은 4.5 만점이 흔해서
  //     "4.1"만 적으면 미국 채용 담당자에게는 불가능한 값으로 보입니다.
  const bareGpa = doc.education.find((e) => e.gpa && BARE_GPA.test(e.gpa));
  if (bareGpa) {
    issues.push(`GPA에 만점을 함께 표기하세요 (예: ${bareGpa.gpa.trim()}/4.5) — 없으면 4.0 만점으로 오해받습니다`);
  } else {
    format += 1;
  }

  // (c) 이력서 본문이 영어인가 — 미국 지원용은 영어가 전제입니다.
  if (/[가-힣]/.test(achievementBullets(doc).join(' '))) {
    issues.push('이력서 본문이 한국어입니다 — 미국 지원용 이력서는 영어로 작성해야 합니다');
  }

  /* ── structuralCompleteness (15) ── */
  const present: string[] = [];
  const missing: string[] = [];
  let structure = 0;

  const checks: Array<[boolean, string, number]> = [
    [!!(doc.basics.name && doc.basics.email), 'Contact', 3],
    [doc.education.length > 0, 'Education', 3],
    [doc.experience.length > 0 || doc.projects.length > 0, 'Experience/Projects', 5],
    [
      doc.skills.languages.length + doc.skills.frameworks.length + doc.skills.tools.length > 0,
      'Skills',
      2,
    ],
    [!!doc.targetRole, 'Target role', 2],
  ];
  for (const [ok, label, pts] of checks) {
    if (ok) {
      structure += pts;
      present.push(label);
    } else {
      missing.push(label);
    }
  }

  /* ── achievementQuality (20) ──
   * 학력 highlights(수강 과목 등)는 제외합니다 — 성과 주장이 아닙니다. */
  const achieveBullets = achievementBullets(doc);
  const weakBullets: string[] = [];
  let achievement = 0;

  if (achieveBullets.length === 0) {
    weakBullets.push('경력·프로젝트에 불릿이 하나도 없습니다');
  } else {
    const quantified = achieveBullets.filter(hasQuantity);
    const strongVerb = achieveBullets.filter((b) => isStrongVerb(firstWord(b)));
    const rightLength = achieveBullets.filter(
      (b) => b.length >= BULLET_MIN && b.length <= BULLET_MAX,
    );

    // 정량적 성과 비율 — 가장 큰 배점 (10)
    achievement += scale(quantified.length / achieveBullets.length, 10);
    // 강한 동사로 시작 (6)
    achievement += scale(strongVerb.length / achieveBullets.length, 6);
    // 적정 길이 (4)
    achievement += scale(rightLength.length / achieveBullets.length, 4);

    // 약한 불릿은 **둘 다 부족한 것**만 지목합니다.
    // 예전에는 수치가 없기만 해도 지목해서, 잘 쓴 불릿까지 "약함"으로 표시됐습니다.
    for (const b of achieveBullets) {
      if (!hasQuantity(b) && !isStrongVerb(firstWord(b))) weakBullets.push(b);
    }
  }

  /* ── readability (10) ── */
  const readIssues: string[] = [];
  let readability = 0;

  if (bullets.length === 0) {
    readIssues.push('평가할 불릿이 없습니다');
  } else {
    const tooLong = bullets.filter((b) => b.length > BULLET_MAX);
    // 길이 하한은 성과 불릿에만 적용합니다 — "Dean's List" 같은 학력 항목은
    // 짧은 것이 정상입니다.
    const tooShort = achieveBullets.filter((b) => b.length < BULLET_MIN);
    const firstPerson = bullets.filter(hasFirstPerson);

    readability += scale(1 - tooLong.length / bullets.length, 4);
    readability += scale(
      achieveBullets.length === 0 ? 1 : 1 - tooShort.length / achieveBullets.length,
      3,
    );
    readability += scale(1 - firstPerson.length / bullets.length, 3);

    if (tooLong.length > 0) readIssues.push(`${tooLong.length}개 불릿이 너무 깁니다 (${BULLET_MAX}자 초과)`);
    if (tooShort.length > 0) readIssues.push(`${tooShort.length}개 불릿이 너무 짧습니다 (${BULLET_MIN}자 미만)`);
    if (firstPerson.length > 0)
      readIssues.push(`${firstPerson.length}개 불릿에 1인칭 대명사(I, my, we)가 있습니다 — 제거하세요`);
  }

  return {
    formatCompatibility: {
      score: Math.round(Math.min(format, 20) * 10) / 10,
      maxScore: 20,
      issues,
      suggestions,
    },
    structuralCompleteness: { score: structure, maxScore: 15, present, missing },
    achievementQuality: {
      score: Math.round(Math.min(achievement, 20) * 10) / 10,
      maxScore: 20,
      weakBullets: weakBullets.slice(0, 5),
      improved: [],
    },
    readability: {
      score: Math.round(Math.min(readability, 10) * 10) / 10,
      maxScore: 10,
      issues: readIssues,
    },
  };
}

/* ────────────────────────────────────────────
   규칙 + LLM 결합
   ──────────────────────────────────────────── */

export interface LlmScores {
  keywordOptimization: { score: number; matched: string[]; missing: string[] };
  grammar: { score: number; errors: string[] };
}

/**
 * 규칙 점수와 LLM 점수를 합쳐 최종 ATSAnalysis를 만든다.
 * `overallScore`는 항상 6개 섹션의 **실제 합계**입니다 — 별도로 추측하지 않습니다.
 */
export function combineScores(
  rules: RuleScores,
  llm: LlmScores,
  doc: ResumeDocument,
): ATSAnalysis {
  const sections: ATSAnalysis['sections'] = {
    formatCompatibility: rules.formatCompatibility,
    keywordOptimization: {
      score: clamp(llm.keywordOptimization.score, 25),
      maxScore: 25,
      matched: llm.keywordOptimization.matched,
      missing: llm.keywordOptimization.missing,
    },
    achievementQuality: rules.achievementQuality,
    structuralCompleteness: rules.structuralCompleteness,
    readability: rules.readability,
    grammar: {
      score: clamp(llm.grammar.score, 10),
      maxScore: 10,
      errors: llm.grammar.errors,
    },
  };

  const overallScore =
    Math.round(
      (sections.formatCompatibility.score +
        sections.keywordOptimization.score +
        sections.achievementQuality.score +
        sections.structuralCompleteness.score +
        sections.readability.score +
        sections.grammar.score) *
        10,
    ) / 10;

  return {
    overallScore,
    sections,
    topStrengths: deriveStrengths(sections, doc),
    criticalImprovements: deriveImprovements(sections),
  };
}

function clamp(n: number, max: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(max, n)) * 10) / 10;
}

/** 섹션 달성률이 높은 것부터 강점으로 뽑는다 */
function deriveStrengths(sections: ATSAnalysis['sections'], doc: ResumeDocument): string[] {
  const labels: Record<string, string> = {
    formatCompatibility: 'ATS 친화적 포맷',
    keywordOptimization: '직무 키워드 적합도',
    achievementQuality: '정량적 성과 서술',
    structuralCompleteness: '필수 섹션 완비',
    readability: '간결한 가독성',
    grammar: '문법 정확도',
  };

  const ranked = Object.entries(sections)
    .map(([key, s]) => ({ key, ratio: s.score / s.maxScore }))
    .filter((s) => s.ratio >= 0.8)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map((s) => labels[s.key]);

  if (ranked.length === 0 && doc.experience.length + doc.projects.length > 0) {
    ranked.push('경력·프로젝트 경험 보유');
  }
  return ranked;
}

/** 손실 점수가 큰 섹션부터 개선 과제로 뽑는다 */
function deriveImprovements(sections: ATSAnalysis['sections']): string[] {
  const suggestions: Array<{ lost: number; text: string }> = [
    {
      lost: sections.keywordOptimization.maxScore - sections.keywordOptimization.score,
      text:
        sections.keywordOptimization.missing.length > 0
          ? `누락 키워드 반영: ${sections.keywordOptimization.missing.slice(0, 5).join(', ')}`
          : '직무 키워드를 더 반영하세요',
    },
    {
      lost: sections.achievementQuality.maxScore - sections.achievementQuality.score,
      text: '불릿에 정량적 성과(숫자·%·규모)를 추가하세요',
    },
    {
      lost: sections.structuralCompleteness.maxScore - sections.structuralCompleteness.score,
      text:
        sections.structuralCompleteness.missing.length > 0
          ? `누락 섹션 보완: ${sections.structuralCompleteness.missing.join(', ')}`
          : '',
    },
    {
      lost: sections.formatCompatibility.maxScore - sections.formatCompatibility.score,
      text: sections.formatCompatibility.issues[0] ?? '',
    },
    {
      lost: sections.readability.maxScore - sections.readability.score,
      text: sections.readability.issues[0] ?? '',
    },
    {
      lost: sections.grammar.maxScore - sections.grammar.score,
      text: sections.grammar.errors[0] ? `문법 수정: ${sections.grammar.errors[0]}` : '',
    },
  ];

  return suggestions
    .filter((s) => s.lost > 1 && s.text.length > 0)
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 3)
    .map((s) => s.text);
}

/** 점수 → 등급 (UI 표시에 사용) */
export function gradeOf(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}
