/**
 * PDF 텍스트 추출 유틸리티
 * pdfjs-dist를 CDN ESM import로 로드 — webpack 번들링 문제 회피.
 * ChatInterface + ResumeUploader 양쪽에서 사용.
 */

const PDFJS_VERSION = '4.9.155';
const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

/** CDN 로딩 타임아웃 (ms) */
const CDN_LOAD_TIMEOUT = 15_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfjsLib = any;

let pdfjsPromise: Promise<PdfjsLib> | null = null;

function loadPdfJs(): Promise<PdfjsLib> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise<PdfjsLib>((resolve, reject) => {
    // 이미 로드되었으면 바로 반환
    if ((window as any).__pdfjsLib) {
      resolve((window as any).__pdfjsLib);
      return;
    }

    let settled = false;

    // <script> 태그를 먼저 생성 — cleanup에서 DOM에서 제거하기 위해
    const loader = document.createElement('script');
    loader.type = 'module';
    loader.textContent = [
      `import * as pdfjsLib from '${PDFJS_CDN}/pdf.min.mjs';`,
      `pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_CDN}/pdf.worker.min.mjs';`,
      `window.__pdfjsLib = pdfjsLib;`,
      `window.dispatchEvent(new Event('pdfjsReady'));`,
    ].join('\n');

    const cleanup = () => {
      window.removeEventListener('pdfjsReady', onReady);
      clearTimeout(timer);
      loader.remove(); // DOM에서 script 태그 제거 (메모리 누수 방지)
    };

    const onReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const lib = (window as any).__pdfjsLib;
      if (lib) {
        resolve(lib);
      } else {
        pdfjsPromise = null;
        reject(new Error('pdfjs-dist 로드 실패'));
      }
    };

    // 타임아웃 — CDN 응답이 너무 오래 걸리면 실패 처리
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      pdfjsPromise = null;
      reject(new Error('pdfjs-dist CDN 로드 타임아웃'));
    }, CDN_LOAD_TIMEOUT);

    window.addEventListener('pdfjsReady', onReady);

    loader.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      pdfjsPromise = null;
      reject(new Error('pdfjs-dist CDN 로드 실패'));
    };

    document.head.appendChild(loader);
  });

  return pdfjsPromise;
}

/**
 * PDF.js를 브라우저 idle 시점에 프리로드한다.
 * 첫 PDF 업로드 시 대기 시간을 줄여준다.
 */
export function preloadPdfJs(): void {
  if (typeof window === 'undefined') return;

  // Safari는 requestIdleCallback 미지원 — typeof 체크로 안전하게 분기
  const scheduleIdle: (cb: () => void) => void =
    typeof window.requestIdleCallback === 'function'
      ? (cb) => window.requestIdleCallback(cb)
      : (cb) => setTimeout(cb, 2000);

  scheduleIdle(() => {
    loadPdfJs().catch(() => {
      // 프리로드 실패는 무시 — 실제 사용 시점에 다시 시도
    });
  });
}

export async function extractTextFromPDF(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF 파싱은 브라우저 환경에서만 가능합니다');
  }

  const pdfjsLib = await loadPdfJs();

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str?: string }>)
      .filter((item): item is { str: string } => typeof item.str === 'string')
      .map((item) => item.str)
      .join(' ');
    pageTexts.push(text);
  }

  const result = pageTexts.join('\n').trim();
  if (!result) {
    throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF일 수 있습니다.');
  }

  return result;
}
