/**
 * 이력서 내보내기 (클라이언트 전용)
 * ------------------------------------------------------------------
 * PDF · DOCX · Markdown · HTML · JSON 다운로드를 담당합니다.
 *
 * **PDF 전략: 브라우저 인쇄 엔진 사용**
 * jsPDF + html2canvas 같은 조합은 이력서를 *이미지로 래스터화*하기 때문에
 * ATS가 텍스트를 한 글자도 읽지 못합니다 — 이력서에서는 치명적입니다.
 * 브라우저 인쇄는 텍스트를 선택 가능한 실제 텍스트로 유지하고,
 * 폰트 임베딩·페이지 나눔·하이픈 처리도 브라우저가 알아서 합니다.
 *
 * 기존 구현은 `window.open()` + `document.write()`를 썼는데
 * (a) 팝업 차단기에 막히고 (b) `document.write`는 폐기 예정 API이며
 * (c) 정규식 마크다운 파서를 거치며 서식이 깨졌습니다.
 * 여기서는 **숨긴 iframe + `srcdoc`** 을 씁니다 — 팝업 차단 대상이 아니고,
 * 문서를 통째로 넘기므로 파싱 단계가 아예 없습니다.
 */

import type { ResumeDocument } from './schema';
import { toMarkdown } from './render/markdown';
import { toPrintHtml, resumeFileName, type PrintOptions } from './render/print-html';

/** Blob을 파일로 다운로드시킨다. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke는 다음 틱에 — 즉시 호출하면 일부 브라우저에서 다운로드가 취소됩니다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function downloadText(content: string, fileName: string, mime: string): void {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), fileName);
}

/* ────────────────────────────────────────────
   텍스트 계열 내보내기
   ──────────────────────────────────────────── */

export function exportMarkdown(doc: ResumeDocument): void {
  downloadText(toMarkdown(doc), resumeFileName(doc, 'md'), 'text/markdown');
}

export function exportHtml(doc: ResumeDocument, options?: PrintOptions): void {
  downloadText(toPrintHtml(doc, options), resumeFileName(doc, 'html'), 'text/html');
}

/** 정본 JSON — 나중에 다시 불러오거나 백업하는 용도 */
export function exportJson(doc: ResumeDocument): void {
  downloadText(JSON.stringify(doc, null, 2), resumeFileName(doc, 'json'), 'application/json');
}

/* ────────────────────────────────────────────
   PDF — 숨긴 iframe + 브라우저 인쇄
   ──────────────────────────────────────────── */

/**
 * 인쇄 대화상자를 띄운다. 사용자가 "PDF로 저장"을 고르면
 * 텍스트가 살아 있는 ATS 친화 PDF가 만들어집니다.
 *
 * 브라우저가 인쇄 대화상자를 닫는 시점을 알려주지 않는 경우가 있어
 * `afterprint` 이벤트와 타임아웃을 함께 걸어 iframe을 정리합니다.
 */
export function exportPdf(doc: ResumeDocument, options?: PrintOptions): Promise<void> {
  return new Promise((resolve) => {
    const html = toPrintHtml(doc, options);

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    /* 심층 방어: 스크립트 실행을 아예 막습니다.
     * `allow-scripts`가 없으므로 문서 안의 <script>는 실행되지 않고,
     * `allow-same-origin`은 남겨 두어 부모가 print()를 호출할 수 있습니다.
     * (print-html.ts가 모든 입력을 escape하므로 현재 알려진 우회는 없지만,
     *  이스케이프가 한 군데라도 빠지는 날을 대비한 2차 방어입니다.) */
    iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
    // 화면 밖으로 밀어 둡니다. display:none이면 일부 브라우저가 인쇄를 거부합니다.
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none;';

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      iframe.remove();
      resolve();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        return;
      }

      win.addEventListener('afterprint', cleanup, { once: true });

      // 레이아웃·폰트가 안정된 뒤 인쇄 — 한 프레임으로는 부족한 경우가 있습니다.
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* 인쇄 차단 — 조용히 정리 */
        }
        // afterprint를 발화시키지 않는 브라우저 대비 안전망
        setTimeout(cleanup, 60_000);
      }, 250);
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}

/* ────────────────────────────────────────────
   DOCX
   ──────────────────────────────────────────── */

/**
 * .docx로 내보낸다.
 *
 * 미국 채용에서 `.docx`는 여전히 널리 요구되고, 일부 ATS는 PDF보다
 * Word 문서를 더 안정적으로 파싱합니다.
 *
 * `docx` 패키지는 무겁기 때문에 **동적 import**로 분리했습니다 —
 * 실제로 DOCX를 누르는 사용자만 번들을 내려받습니다.
 */
export async function exportDocx(doc: ResumeDocument): Promise<void> {
  const { toDocxBlob } = await import('./render/docx');
  const blob = await toDocxBlob(doc);
  downloadBlob(blob, resumeFileName(doc, 'docx'));
}

/** UI에서 노출할 내보내기 형식 */
export const EXPORT_FORMATS = ['pdf', 'docx', 'md', 'json'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export async function exportResume(
  doc: ResumeDocument,
  format: ExportFormat,
  options?: PrintOptions,
): Promise<void> {
  switch (format) {
    case 'pdf':
      return exportPdf(doc, options);
    case 'docx':
      return exportDocx(doc);
    case 'md':
      return exportMarkdown(doc);
    case 'json':
      return exportJson(doc);
  }
}
