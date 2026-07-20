/**
 * ResumeDocument → 마크다운
 * ------------------------------------------------------------------
 * **순수 함수입니다. LLM을 호출하지 않습니다.**
 *
 * 기존 구현은 gpt-4o-mini에게 "JSON을 마크다운으로 바꿔줘"라고 시켰습니다.
 * 그 결과 (a) 내용이 임의로 각색되고 (b) 매번 다른 포맷이 나오고
 * (c) 검증이 불가능했습니다. 렌더링은 결정론적 코드의 일이고,
 * LLM은 *내용을 좋게 만드는* 일만 맡습니다.
 */

import type { ResumeDocument } from '../schema';
import { formatDateRange, formatEducationDate, contactLine, sectionOrder } from './shared';

/**
 * 마크다운 이스케이프 — **최소한으로만** 적용합니다.
 *
 * 모든 구두점을 이스케이프하면 `B\.S\.`, `Next\.js`, `3\.8/4\.0` 같은
 * 읽기 괴로운 결과가 나옵니다. 실제로 서식을 깨뜨릴 수 있는 문자만 처리합니다:
 *  - 인라인: 강조·링크·코드를 여는 문자
 *  - 줄머리: 헤딩·목록·인용으로 오인될 수 있는 문자
 * 문장 중간의 `.` `-` 등은 마크다운에서 아무 의미가 없으므로 건드리지 않습니다.
 */
const INLINE_ESCAPE = /([\\`*_[\]<>])/g;
const LINE_LEAD_ESCAPE = /^(\s*)([#>+-]|\d+\.)/;

function esc(s: string): string {
  return s.replace(INLINE_ESCAPE, '\\$1').replace(LINE_LEAD_ESCAPE, '$1\\$2');
}

/** 링크로 표시할 값 정리 (스킴 없으면 https를 붙임) */
function link(label: string, url: string): string {
  if (!url) return '';
  // mailto:를 이미 갖춘 값에 https://를 덧붙이지 않도록 스킴 전체를 검사합니다.
  const href = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
  return `[${esc(label)}](${href})`;
}

export function toMarkdown(doc: ResumeDocument): string {
  const out: string[] = [];

  /* ── 헤더: 이름 + 연락처 한 줄 ── */
  if (doc.basics.name) out.push(`# ${esc(doc.basics.name)}`);

  const contacts = contactLine(doc.basics).map((c) =>
    c.url ? link(c.label, c.url) : esc(c.label),
  );
  if (contacts.length > 0) out.push(contacts.join(' | '));

  /* ── 섹션 ── */
  for (const section of sectionOrder(doc)) {
    switch (section) {
      case 'summary': {
        out.push('', '## Summary', '', esc(doc.basics.summary));
        break;
      }

      case 'education': {
        out.push('', '## Education');
        for (const e of doc.education) {
          const headline = [e.degree, e.major].filter(Boolean).join(', ');
          const range = formatEducationDate(e.startDate, e.endDate);
          out.push('');
          out.push(`### ${esc(e.school)}${range ? ` — ${esc(range)}` : ''}`);
          const detail = [headline, e.gpa ? `GPA: ${e.gpa}` : '', e.location]
            .filter(Boolean)
            .join(' · ');
          if (detail) out.push(esc(detail));
          for (const h of e.highlights) out.push(`- ${esc(h)}`);
        }
        break;
      }

      case 'experience': {
        out.push('', '## Experience');
        for (const x of doc.experience) {
          const range = formatDateRange(x.startDate, x.endDate, x.current);
          out.push('');
          out.push(`### ${esc(x.title)}${x.company ? `, ${esc(x.company)}` : ''}`);
          const meta = [x.location, range].filter(Boolean).join(' · ');
          if (meta) out.push(esc(meta));
          for (const b of x.bullets) out.push(`- ${esc(b)}`);
        }
        break;
      }

      case 'projects': {
        out.push('', '## Projects');
        for (const p of doc.projects) {
          const range = formatDateRange(p.startDate, p.endDate, false);
          const title = p.url ? link(p.name, p.url) : esc(p.name);
          out.push('');
          out.push(`### ${title}${p.role ? ` — ${esc(p.role)}` : ''}`);
          const meta = [p.tech.join(', '), range].filter(Boolean).join(' · ');
          if (meta) out.push(esc(meta));
          for (const b of p.bullets) out.push(`- ${esc(b)}`);
        }
        break;
      }

      case 'skills': {
        out.push('', '## Skills');
        const rows: Array<[string, string[]]> = [
          ['Languages', doc.skills.languages],
          ['Frameworks', doc.skills.frameworks],
          ['Tools', doc.skills.tools],
          ['Other', doc.skills.other],
        ];
        for (const [label, values] of rows) {
          if (values.length > 0) out.push(`- **${label}:** ${esc(values.join(', '))}`);
        }
        break;
      }
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/**
 * ATS 키워드 스캔용 평문.
 * 서식 기호를 모두 제거해 순수 텍스트만 남깁니다 — 채점기가 이 결과를 읽습니다.
 */
export function toPlainText(doc: ResumeDocument): string {
  return toMarkdown(doc)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 링크 → 라벨만
    .replace(/\\([\\`*_[\]<>#>+-]|\\?\d+\.)/g, '$1') // 이스케이프 해제 (esc()와 대칭)
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
