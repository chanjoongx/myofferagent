/**
 * ResumeDocument → 인쇄용 HTML (PDF 출력의 원본)
 * ------------------------------------------------------------------
 * 브라우저의 "PDF로 저장"에 그대로 넘길 수 있는 단일 문서를 만듭니다.
 *
 * **ATS 파싱 가능성을 최우선으로 설계했습니다:**
 *  - 단일 컬럼 — 다단 레이아웃은 파서가 열을 뒤섞습니다.
 *  - 레이아웃용 `<table>` 없음 — Taleo·Workday 계열이 셀 순서를 흐트러뜨립니다.
 *  - `<header>`/`<footer>` 없음 — 다수 파서가 머리말·꼬리말을 통째로 버립니다.
 *  - 표준 영문 섹션 헤더(Education/Experience/…) — 창의적 명칭은 인식되지 않습니다.
 *  - 텍스트는 **선택 가능한 실제 텍스트**. 이미지·아이콘 폰트를 쓰지 않습니다.
 *    (html2canvas류로 래스터화하면 ATS가 한 글자도 읽지 못합니다.)
 *  - DOM 순서 = 읽기 순서. 날짜를 오른쪽에 붙이더라도 제목이 먼저 오게 둡니다.
 *
 * 보안: 모든 사용자 입력은 `esc()`로 이스케이프합니다.
 * 이 HTML은 iframe `srcdoc`에 주입되므로 이스케이프 누락은 곧 XSS입니다.
 */

import type { ResumeDocument } from '../schema';
import {
  formatDateRange,
  formatEducationDate,
  contactLine,
  sectionOrder,
  SECTION_HEADINGS,
  type SectionKey,
} from './shared';

export interface PrintOptions {
  /** 본문 서체 계열. ATS 안전 폰트만 노출합니다. */
  fontFamily?: 'serif' | 'sans';
  /** 본문 크기(pt). 10–12pt가 일반적입니다. */
  fontSizePt?: number;
  /** 페이지 여백(inch). */
  marginIn?: number;
  /** 용지 크기. 미국 지원은 letter가 기본입니다. */
  paper?: 'letter' | 'a4';
}

const DEFAULTS: Required<PrintOptions> = {
  fontFamily: 'serif',
  fontSizePt: 10.5,
  marginIn: 0.6,
  paper: 'letter',
};

/**
 * ATS가 안정적으로 처리하는 표준 폰트 스택.
 * 한글 폴백을 명시해 둡니다 — 지정하지 않으면 OS 기본 글꼴로 떨어져
 * 같은 이력서가 기기마다 다르게 줄바꿈됩니다.
 */
const FONT_STACKS = {
  serif: `Georgia, 'Times New Roman', Times, 'Malgun Gothic', 'Apple SD Gothic Neo', serif`,
  sans: `Calibri, Arial, Helvetica, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`,
} as const;

/** 한글이 포함되어 있으면 문서 언어를 ko로 — 하이픈·줄바꿈 규칙이 달라집니다. */
function detectLang(doc: ResumeDocument): 'ko' | 'en' {
  const sample = [
    doc.basics.name,
    doc.basics.summary,
    ...doc.experience.flatMap((x) => x.bullets),
    ...doc.projects.flatMap((p) => p.bullets),
  ].join(' ');
  return /[ㄱ-힝]/.test(sample) ? 'ko' : 'en';
}

/** HTML 이스케이프 — 모든 사용자 입력에 반드시 적용 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 안전한 href만 통과 — javascript: 등 차단 */
function safeHref(url: string): string | null {
  const candidate = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.href;
    }
  } catch {
    /* 잘못된 URL */
  }
  return null;
}

function anchor(label: string, url: string): string {
  const href = safeHref(url);
  return href
    ? `<a href="${esc(href)}">${esc(label)}</a>`
    : esc(label);
}

/** 제목 줄 — 왼쪽 본문 + 오른쪽 날짜. DOM 순서상 제목이 먼저입니다. */
function entryHead(left: string, right: string): string {
  return (
    `<div class="row">` +
    `<div class="left">${left}</div>` +
    (right ? `<div class="right">${esc(right)}</div>` : '') +
    `</div>`
  );
}

function bulletList(items: string[]): string {
  if (items.length === 0) return '';
  return `<ul>${items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
}

function renderSection(doc: ResumeDocument, key: SectionKey): string {
  const heading = `<h2>${SECTION_HEADINGS[key]}</h2>`;

  switch (key) {
    case 'summary':
      return heading + `<p class="summary">${esc(doc.basics.summary)}</p>`;

    case 'education':
      return (
        heading +
        doc.education
          .map((e) => {
            const detail = [
              [e.degree, e.major].filter(Boolean).join(', '),
              e.gpa ? `GPA: ${e.gpa}` : '',
              e.location,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              `<div class="entry">` +
              entryHead(
                `<span class="org">${esc(e.school)}</span>`,
                formatEducationDate(e.startDate, e.endDate),
              ) +
              (detail ? `<div class="detail">${esc(detail)}</div>` : '') +
              bulletList(e.highlights) +
              `</div>`
            );
          })
          .join('')
      );

    case 'experience':
      return (
        heading +
        doc.experience
          .map((x) => {
            const left =
              `<span class="role">${esc(x.title)}</span>` +
              (x.company ? `<span class="org"> — ${esc(x.company)}</span>` : '');
            return (
              `<div class="entry">` +
              entryHead(left, formatDateRange(x.startDate, x.endDate, x.current)) +
              (x.location ? `<div class="detail">${esc(x.location)}</div>` : '') +
              bulletList(x.bullets) +
              `</div>`
            );
          })
          .join('')
      );

    case 'projects':
      return (
        heading +
        doc.projects
          .map((p) => {
            const name = p.url
              ? `<span class="role">${anchor(p.name, p.url)}</span>`
              : `<span class="role">${esc(p.name)}</span>`;
            const left = name + (p.role ? `<span class="org"> — ${esc(p.role)}</span>` : '');
            return (
              `<div class="entry">` +
              entryHead(left, formatDateRange(p.startDate, p.endDate, false)) +
              (p.tech.length > 0
                ? `<div class="detail">${esc(p.tech.join(', '))}</div>`
                : '') +
              bulletList(p.bullets) +
              `</div>`
            );
          })
          .join('')
      );

    case 'skills': {
      const rows: Array<[string, string[]]> = [
        ['Languages', doc.skills.languages],
        ['Frameworks', doc.skills.frameworks],
        ['Tools', doc.skills.tools],
        ['Other', doc.skills.other],
      ];
      return (
        heading +
        `<div class="entry">` +
        rows
          .filter(([, v]) => v.length > 0)
          .map(
            ([label, v]) =>
              `<div class="skill-row"><span class="skill-label">${label}:</span> ${esc(v.join(', '))}</div>`,
          )
          .join('') +
        `</div>`
      );
    }
  }
}

/** 인쇄용 스타일. 화면이 아니라 종이를 기준으로 작성되었습니다. */
function styles(opts: Required<PrintOptions>): string {
  return `
  /* 여백을 @page가 아니라 body padding으로 잡습니다.
   * Chrome은 페이지 여백이 약 8mm를 넘으면 URL·날짜·페이지 번호를 자동으로
   * 끼워 넣고, 그대로 저장된 PDF에 인쇄됩니다. margin:0이면 그 머리말이
   * 아예 생기지 않습니다.
   * (한계: body padding의 상/하단은 첫 페이지와 마지막 페이지에만 적용됩니다.
   *  신입 이력서는 1페이지가 표준이고 ATS 채점기도 1페이지를 넘기면 감점하므로
   *  이 트레이드오프를 택했습니다.) */
  @page { size: ${opts.paper}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: ${FONT_STACKS[opts.fontFamily]};
    font-size: ${opts.fontSizePt}pt;
    line-height: 1.38;
    color: #000;
    background: #fff;
  }
  body { padding: ${opts.marginIn}in; }

  /* 섹션 헤더가 페이지 끝에 홀로 남지 않도록 */
  h2 { break-after: avoid; page-break-after: avoid; }
  p  { orphans: 2; widows: 2; }

  /* 이름과 연락처 영역. 시맨틱 header 요소는 ATS가 통째로 버릴 수 있어 div로 둡니다. */
  .name {
    font-size: ${(opts.fontSizePt * 1.95).toFixed(1)}pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    margin-bottom: 3pt;
  }
  .contacts {
    font-size: ${(opts.fontSizePt * 0.92).toFixed(1)}pt;
    margin-bottom: 10pt;
  }
  .contacts a { color: #000; text-decoration: none; }
  .sep { padding: 0 5pt; }

  h2 {
    font-size: ${(opts.fontSizePt * 1.02).toFixed(1)}pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 0.75pt solid #000;
    padding-bottom: 1.5pt;
    margin: 11pt 0 5pt;
  }

  /* 항목이 페이지 경계에서 잘리지 않도록 */
  .entry { margin-bottom: 7pt; page-break-inside: avoid; break-inside: avoid; }

  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
  .left { flex: 1; min-width: 0; }
  .right { white-space: nowrap; font-size: ${(opts.fontSizePt * 0.94).toFixed(1)}pt; }

  .role { font-weight: 700; }
  .org  { font-weight: 400; }
  .detail {
    font-size: ${(opts.fontSizePt * 0.94).toFixed(1)}pt;
    font-style: italic;
    margin-top: 0.5pt;
  }
  .summary { margin-bottom: 2pt; }

  ul { margin: 3pt 0 0 14pt; }
  li { margin-bottom: 1.5pt; padding-left: 1pt; }

  .skill-row { margin-bottom: 2pt; }
  .skill-label { font-weight: 700; }

  a { color: #000; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }`;
}

/**
 * 완전한 독립 HTML 문서를 만든다.
 * iframe `srcdoc`에 넣거나 그대로 파일로 저장할 수 있습니다.
 */
export function toPrintHtml(doc: ResumeDocument, options: PrintOptions = {}): string {
  // opts 값은 <style>/@page에 이스케이프 없이 삽입됩니다. 타입은 런타임에 지워지므로,
  // 호출자가 사용자 입력을 넘기더라도 CSS가 주입되지 않도록 여기서 검증·절삭합니다.
  // (현재 유일한 호출자는 옵션을 넘기지 않지만, 이 파일은 "모든 입력을 이스케이프한다"를
  //  약속하므로 그 계약을 스타일 값에도 지킵니다.)
  const clampNum = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  const opts: Required<PrintOptions> = {
    fontFamily: options.fontFamily === 'sans' ? 'sans' : DEFAULTS.fontFamily,
    paper: options.paper === 'a4' ? 'a4' : DEFAULTS.paper,
    fontSizePt: clampNum(options.fontSizePt, 8, 16, DEFAULTS.fontSizePt),
    marginIn: clampNum(options.marginIn, 0, 1.5, DEFAULTS.marginIn),
  };

  const contacts = contactLine(doc.basics)
    .map((c) => (c.url ? anchor(c.label, c.url) : esc(c.label)))
    .join('<span class="sep">·</span>');

  const body =
    (doc.basics.name ? `<div class="name">${esc(doc.basics.name)}</div>` : '') +
    (contacts ? `<div class="contacts">${contacts}</div>` : '') +
    sectionOrder(doc)
      .map((key) => renderSection(doc, key))
      .join('');

  // <title>은 Chrome의 "PDF로 저장" 기본 파일명이 됩니다 —
  // 채용 담당자가 받는 파일명이므로 관례에 맞춰 밑줄 형식으로 둡니다.
  const title = resumeFileName(doc, '').replace(/\.$/, '');

  return `<!DOCTYPE html>
<html lang="${detectLang(doc)}">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${styles(opts)}</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * 다운로드 파일명을 만든다.
 * 채용 담당자가 파일명만 보고 지원자를 식별할 수 있어야 하며,
 * 공백·특수문자는 일부 ATS 업로드에서 문제를 일으킵니다.
 */
/**
 * 파일명에 쓸 수 있게 정리한다.
 *
 * ⚠️ 예전에는 `[^\w\s-]`로 걸렀는데 `\w`는 **ASCII 전용**이라 한글이 통째로
 * 지워졌습니다. "박지우"는 빈 문자열이 되어 `_Resume_SWE.pdf`가 만들어졌고,
 * **채용 담당자는 지원자 이름이 없는 파일을 받았습니다.**
 * 유니코드 문자·숫자를 보존하고, 경로 구분자 등 위험한 문자만 제거합니다.
 */
function fileSafe(text: string): string {
  return text
    .replace(/[/\\:*?"<>|]/g, '') // 파일 시스템 예약 문자
    .replace(/[^\p{L}\p{N}\s_-]/gu, '') // 그 외 기호 제거, 문자·숫자는 언어 무관 보존
    .trim()
    .replace(/\s+/g, '_');
}

export function resumeFileName(doc: ResumeDocument, ext: string): string {
  // 정리 후 비면 'Resume'로 되돌립니다 — 이름 없는 파일명이 나오지 않도록.
  const base = fileSafe(doc.basics.name) || 'Resume';
  const role = doc.targetRole ? '_' + fileSafe(doc.targetRole) : '';
  return `${base}_Resume${role}.${ext}`.replace(/_{2,}/g, '_');
}
