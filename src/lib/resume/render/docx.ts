/**
 * ResumeDocument → .docx (Word)
 * ------------------------------------------------------------------
 * 미국 채용에서 `.docx`는 여전히 흔한 요구 형식이고,
 * 일부 ATS는 PDF보다 Word 문서를 더 안정적으로 파싱합니다.
 *
 * 인쇄용 HTML과 **동일한 ATS 규칙**을 따릅니다:
 *  - 표·텍스트 상자·머리말/꼬리말 없음 (파서가 버리거나 순서를 뒤섞습니다)
 *  - 단일 컬럼, 표준 영문 섹션 헤더
 *  - 날짜 정렬은 오른쪽 **탭 스톱**으로 처리 — 표를 쓰지 않으면서도
 *    제목과 날짜가 한 문단에 남아 읽기 순서가 보존됩니다.
 *
 * 이 모듈은 `export.ts`에서 **동적 import** 됩니다. docx 번들이 크기 때문에
 * DOCX를 실제로 내려받는 사용자만 비용을 지불하게 하기 위함입니다.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
  TabStopType,
  BorderStyle,
  convertInchesToTwip,
} from 'docx';
import type { ResumeDocument } from '../schema';
import {
  formatDateRange,
  formatEducationDate,
  contactLine,
  sectionOrder,
  SECTION_HEADINGS,
  type SectionKey,
} from './shared';

/* ── 문서 치수 ──
 * docx 단위: 폰트 크기는 half-point, 길이는 twip(1인치 = 1440).
 *
 * ⚠️ `page.size`는 **반드시 명시**해야 합니다.
 * 생략하면 docx가 A4(11906×16838 twip)로 기본 설정하는데, 아래 탭 스톱은
 * US Letter 기준(7.30in)으로 계산됩니다. A4의 본문 폭은 0.6in 여백에서
 * 7.07in이므로 탭 스톱이 본문 밖 0.23in 지점에 놓여 **날짜가 줄바꿈됩니다.** */
const MARGIN_IN = 0.6;
const PAGE_WIDTH_IN = 8.5; // US Letter
const PAGE_HEIGHT_IN = 11;
const CONTENT_WIDTH_IN = PAGE_WIDTH_IN - MARGIN_IN * 2;

const FONT = 'Calibri';
const BODY_HALF_PT = 21; // 10.5pt
const NAME_HALF_PT = 40; // 20pt
const SMALL_HALF_PT = 19; // 9.5pt

/** 오른쪽 탭 스톱 위치 — 날짜를 우측 정렬시키는 데 사용 */
const RIGHT_TAB = convertInchesToTwip(CONTENT_WIDTH_IN);

function run(text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) {
  return new TextRun({
    text,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    size: opts.size ?? BODY_HALF_PT,
    font: FONT,
  });
}

/** 안전한 URL만 하이퍼링크로 — 그 외에는 평문으로 떨어뜨립니다. */
function safeLink(url: string): string | null {
  const candidate = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
  try {
    const p = new URL(candidate);
    return ['http:', 'https:', 'mailto:'].includes(p.protocol) ? p.href : null;
  } catch {
    return null;
  }
}

function linkRun(label: string, url: string) {
  const href = safeLink(url);
  if (!href) return run(label, { size: SMALL_HALF_PT });
  return new ExternalHyperlink({
    link: href,
    children: [
      new TextRun({ text: label, size: SMALL_HALF_PT, font: FONT, style: 'Hyperlink' }),
    ],
  });
}

/** 섹션 헤더 — 대문자 + 아래 실선 */
function sectionHeading(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 90 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 },
    },
    children: [run(label.toUpperCase(), { bold: true, size: BODY_HALF_PT })],
  });
}

/**
 * 제목 + 우측 날짜를 한 문단에 담는다.
 * 탭 스톱을 쓰므로 표 없이도 날짜가 오른쪽 끝에 정렬됩니다.
 */
function entryHeading(left: TextRun[], right: string): Paragraph {
  const children: TextRun[] = [...left];
  if (right) {
    children.push(new TextRun({ text: '\t', font: FONT }));
    children.push(run(right, { size: SMALL_HALF_PT }));
  }
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
    spacing: { before: 110, after: 0 },
    keepNext: true, // 제목이 페이지 끝에 홀로 남지 않도록
    children,
  });
}

function detailLine(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 20 },
    children: [run(text, { italics: true, size: SMALL_HALF_PT })],
  });
}

function bullets(items: string[]): Paragraph[] {
  return items.map(
    (b) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 20 },
        children: [run(b)],
      }),
  );
}

function renderSection(doc: ResumeDocument, key: SectionKey): Paragraph[] {
  const out: Paragraph[] = [sectionHeading(SECTION_HEADINGS[key])];

  switch (key) {
    case 'summary':
      out.push(new Paragraph({ children: [run(doc.basics.summary)] }));
      break;

    case 'education':
      for (const e of doc.education) {
        out.push(entryHeading([run(e.school, { bold: true })], formatEducationDate(e.startDate, e.endDate)));
        const detail = [
          [e.degree, e.major].filter(Boolean).join(', '),
          e.gpa ? `GPA: ${e.gpa}` : '',
          e.location,
        ]
          .filter(Boolean)
          .join(' · ');
        if (detail) out.push(detailLine(detail));
        out.push(...bullets(e.highlights));
      }
      break;

    case 'experience':
      for (const x of doc.experience) {
        const left = [run(x.title, { bold: true })];
        if (x.company) left.push(run(` — ${x.company}`));
        out.push(entryHeading(left, formatDateRange(x.startDate, x.endDate, x.current)));
        if (x.location) out.push(detailLine(x.location));
        out.push(...bullets(x.bullets));
      }
      break;

    case 'projects':
      for (const p of doc.projects) {
        const left = [run(p.name, { bold: true })];
        if (p.role) left.push(run(` — ${p.role}`));
        out.push(entryHeading(left, formatDateRange(p.startDate, p.endDate, false)));
        if (p.tech.length > 0) out.push(detailLine(p.tech.join(', ')));
        out.push(...bullets(p.bullets));
      }
      break;

    case 'skills': {
      const rows: Array<[string, string[]]> = [
        ['Languages', doc.skills.languages],
        ['Frameworks', doc.skills.frameworks],
        ['Tools', doc.skills.tools],
        ['Other', doc.skills.other],
      ];
      for (const [label, values] of rows) {
        if (values.length === 0) continue;
        out.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [run(`${label}: `, { bold: true }), run(values.join(', '))],
          }),
        );
      }
      break;
    }
  }

  return out;
}

/** ResumeDocument를 .docx Blob으로 만든다 (브라우저에서 실행). */
export async function toDocxBlob(doc: ResumeDocument): Promise<Blob> {
  const children: Paragraph[] = [];

  /* ── 이름 ── */
  if (doc.basics.name) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [run(doc.basics.name, { bold: true, size: NAME_HALF_PT })],
      }),
    );
  }

  /* ── 연락처 한 줄 ── */
  const contacts = contactLine(doc.basics);
  if (contacts.length > 0) {
    const kids: (TextRun | ExternalHyperlink)[] = [];
    contacts.forEach((c, i) => {
      if (i > 0) kids.push(run('  ·  ', { size: SMALL_HALF_PT }));
      kids.push(c.url ? linkRun(c.label, c.url) : run(c.label, { size: SMALL_HALF_PT }));
    });
    children.push(new Paragraph({ spacing: { after: 60 }, children: kids }));
  }

  /* ── 섹션 ── */
  for (const key of sectionOrder(doc)) {
    children.push(...renderSection(doc, key));
  }

  const document = new Document({
    creator: 'My Offer Agent',
    title: doc.basics.name ? `${doc.basics.name} — Resume` : 'Resume',
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY_HALF_PT } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // 명시하지 않으면 A4로 떨어지고 탭 스톱 계산이 어긋납니다.
            size: {
              width: convertInchesToTwip(PAGE_WIDTH_IN),
              height: convertInchesToTwip(PAGE_HEIGHT_IN),
            },
            margin: {
              top: convertInchesToTwip(MARGIN_IN),
              bottom: convertInchesToTwip(MARGIN_IN),
              left: convertInchesToTwip(MARGIN_IN),
              right: convertInchesToTwip(MARGIN_IN),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
