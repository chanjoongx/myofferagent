/**
 * PDF 텍스트 추출
 * ------------------------------------------------------------------
 * pdfjs-dist를 **로컬 번들에서** 동적 import합니다.
 *
 * ## 왜 CDN을 걷어냈는가
 *
 * 이전 구현은 `<script type="module">`을 만들어 jsdelivr에서 pdf.min.mjs를
 * 가져왔습니다. 문제가 세 가지였습니다:
 *
 *  1. **SRI를 걸 수 없습니다.** `integrity`는 ESM `import` 지정자에 적용되지
 *     않습니다. 즉 CDN이나 그 경로가 오염되면 임의 코드가 우리 오리진에서
 *     실행되고, `localStorage`의 이력서(이름·이메일·전화번호 등 PII 전체)를
 *     읽어 어디로든 보낼 수 있습니다.
 *  2. **모든 사용자에게 로드됐습니다.** PDF를 올리지 않아도 프리로드가 돌아서
 *     `/agent` 방문자 100%가 노출됐습니다.
 *  3. **이미 설치된 패키지를 놔두고** 두 세대 낮은 버전(4.9.155)을 외부에서
 *     받아 왔습니다. `pdfjs-dist`는 처음부터 의존성에 있었습니다.
 *
 * 로컬 번들로 바꾸면서 외부 스크립트 출처가 사라져, 엄격한 CSP를 걸 수 있게 됐습니다.
 */

/** 번들을 한 번만 로드하도록 캐시 */
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = import('pdfjs-dist').then((lib) => {
    // 워커도 번들에서 가져옵니다. `new URL(..., import.meta.url)`은
    // 번들러가 워커 파일을 에셋으로 방출하고 최종 URL로 치환해 줍니다.
    lib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    return lib;
  });

  // 실패하면 캐시를 비워 다음 시도가 가능하게 합니다.
  pdfjsPromise.catch(() => {
    pdfjsPromise = null;
  });

  return pdfjsPromise;
}

/**
 * pdfjs를 브라우저 idle 시점에 프리로드한다.
 * 첫 PDF 업로드 시 대기 시간을 줄여 줍니다.
 */
export function preloadPdfJs(): void {
  if (typeof window === 'undefined') return;

  // Safari는 requestIdleCallback 미지원 — typeof로 안전하게 분기
  const scheduleIdle: (cb: () => void) => void =
    typeof window.requestIdleCallback === 'function'
      ? (cb) => window.requestIdleCallback(cb)
      : (cb) => setTimeout(cb, 2000);

  scheduleIdle(() => {
    loadPdfJs().catch(() => {
      // 프리로드 실패는 무시 — 실제 사용 시점에 다시 시도합니다.
    });
  });
}

export async function extractTextFromPDF(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF 파싱은 브라우저 환경에서만 가능합니다');
  }

  const pdfjs = await loadPdfJs();

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    pageTexts.push(text);
  }

  const result = pageTexts.join('\n').trim();
  if (!result) {
    throw new Error('PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF일 수 있습니다.');
  }

  return result;
}
