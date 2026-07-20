/**
 * 렌더러 공용 헬퍼
 * 마크다운·인쇄용 HTML·DOCX 렌더러가 동일한 규칙을 쓰도록 한 곳에 모읍니다.
 */

import type { Basics, ResumeDocument } from '../schema';

/** 렌더링 순서에 등장할 수 있는 섹션 */
export type SectionKey = 'summary' | 'education' | 'experience' | 'projects' | 'skills';

/**
 * 섹션 순서를 결정한다.
 *
 * 미국 이력서 관례는 **졸업 여부**로 갈립니다:
 *  - 재학 중이거나 갓 졸업했으면 Education 먼저
 *  - 졸업 후 시간이 지났으면 Experience 먼저
 *
 * ⚠️ 예전에는 `doc.experience.length >= 2`로 판단했습니다. 그래서
 * 카페 아르바이트 2개가 Education을 밀어내고, 네이버 인턴 1개짜리
 * 훌륭한 이력서는 Education이 위에 남았습니다. 항목 **개수**는
 * 졸업 여부와 아무 상관이 없습니다.
 *
 * 비어 있는 섹션은 순서에서 제외됩니다.
 */
export function sectionOrder(doc: ResumeDocument, now = new Date()): SectionKey[] {
  // 가장 늦은 졸업(예정) 연도
  const gradYear = doc.education
    .map((e) => yearOf(e.endDate))
    .filter((y): y is number => y !== null)
    .reduce<number | null>((max, y) => (max === null || y > max ? y : max), null);

  // 졸업 연도를 알 수 없으면 경력 유무로 보수적으로 판단합니다.
  const experienceFirst =
    gradYear === null ? doc.experience.length > 0 : gradYear < now.getFullYear();

  const order: SectionKey[] = experienceFirst
    ? ['summary', 'experience', 'education', 'projects', 'skills']
    : ['summary', 'education', 'experience', 'projects', 'skills'];

  return order.filter((key) => {
    switch (key) {
      case 'summary':
        return doc.basics.summary.length > 0;
      case 'education':
        return doc.education.length > 0;
      case 'experience':
        return doc.experience.length > 0;
      case 'projects':
        return doc.projects.length > 0;
      case 'skills':
        return (
          doc.skills.languages.length +
            doc.skills.frameworks.length +
            doc.skills.tools.length +
            doc.skills.other.length >
          0
        );
    }
  });
}

/** 연락처 한 줄에 들어갈 항목 — url이 있으면 링크로 렌더링 */
export interface ContactItem {
  label: string;
  url: string;
}

/**
 * 연락처 줄을 구성한다.
 * URL은 표시용으로 스킴(`https://`)과 끝 슬래시를 벗겨 짧게 보여주되,
 * 실제 링크 대상은 원본 값을 사용합니다.
 */
export function contactLine(basics: Basics): ContactItem[] {
  const items: ContactItem[] = [];

  if (basics.email) items.push({ label: basics.email, url: `mailto:${basics.email}` });
  if (basics.phone) items.push({ label: basics.phone, url: '' });
  if (basics.location) items.push({ label: basics.location, url: '' });
  if (basics.linkedin) items.push({ label: displayUrl(basics.linkedin), url: basics.linkedin });
  if (basics.github) items.push({ label: displayUrl(basics.github), url: basics.github });
  if (basics.website) items.push({ label: displayUrl(basics.website), url: basics.website });

  return items;
}

/** `https://www.linkedin.com/in/foo/` → `linkedin.com/in/foo` */
export function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

/* ────────────────────────────────────────────
   날짜 정규화
   ────────────────────────────────────────────
 * 날짜는 스키마상 자유 문자열입니다 — LLM과 사용자가 채우기 쉬워야 하니까요.
 * 하지만 **출력에서는 형식이 섞이면 안 됩니다.** 정규화 없이는
 * "2024-06 – Aug 2024" 같은 결과가 그대로 이력서에 인쇄됩니다.
 *
 * 인식하지 못한 값은 **그대로 둡니다** — 사용자 입력을 파싱 실패로
 * 망가뜨리는 것보다 원문을 보여주는 편이 낫습니다. */

const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec',
] as const;

const MONTH_LOOKUP: Record<string, number> = {};
for (const [i, m] of MONTHS.entries()) MONTH_LOOKUP[m.toLowerCase()] = i + 1;
for (const [i, m] of ['january','february','march','april','may','june','july','august','september','october','november','december'].entries()) {
  MONTH_LOOKUP[m] = i + 1;
}

/** "현재"를 뜻하는 표현 */
const PRESENT_RE = /^(present|current|now|현재|재직\s*중)$/i;

/**
 * 날짜 문자열을 "Mon YYYY"로 정규화한다.
 * 인식 실패 시 원문을 그대로 반환합니다.
 */
export function normalizeDate(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  if (PRESENT_RE.test(raw)) return 'Present';

  // 2024-06, 2024/06, 2024.06 (+선택적 일자)
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (iso) {
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) return `${MONTHS[month - 1]} ${iso[1]}`;
  }

  // Jun 2025 / June 2025 / JUN. 2025
  const monthFirst = raw.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (monthFirst) {
    const month = MONTH_LOOKUP[monthFirst[1].toLowerCase()];
    if (month) return `${MONTHS[month - 1]} ${monthFirst[2]}`;
  }

  // 2025년 6월
  const korean = raw.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월$/);
  if (korean) {
    const month = Number(korean[2]);
    if (month >= 1 && month <= 12) return `${MONTHS[month - 1]} ${korean[1]}`;
  }

  // 연도만
  if (/^\d{4}$/.test(raw)) return raw;

  return raw;
}

/** 정규화된 날짜에서 연도를 뽑는다 (섹션 순서 판단용) */
export function yearOf(input: string): number | null {
  const m = normalizeDate(input).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

/**
 * 기간 문자열을 만든다.
 * `current`가 true면 종료일 대신 "Present"를 씁니다.
 */
export function formatDateRange(start: string, end: string, current: boolean): string {
  const from = normalizeDate(start);
  const to = current ? 'Present' : normalizeDate(end);
  if (from && to) return `${from} – ${to}`;
  return from || to || '';
}

/**
 * 학력 기간 표기.
 *
 * 미국 신입 이력서 관례는 재학 기간 전체가 아니라 **졸업(예정)일 하나**입니다.
 * 한 줄을 아끼고, 채용 담당자가 실제로 보는 정보만 남깁니다.
 */
export function formatEducationDate(start: string, end: string, now = new Date()): string {
  const endYear = yearOf(end);
  if (!end) return normalizeDate(start);

  const normalized = normalizeDate(end);
  // 졸업일이 미래면 "Expected"를 붙입니다.
  if (endYear !== null && endYear > now.getFullYear()) return `Expected ${normalized}`;
  return normalized;
}

/** 섹션 헤더 표기 — ATS 파서가 인식하는 표준 영문 명칭만 사용합니다. */
export const SECTION_HEADINGS: Record<SectionKey, string> = {
  summary: 'Summary',
  education: 'Education',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
};
