/**
 * 실제 브라우저 검증 (Playwright + Chromium)
 *
 * 정적 분석으로는 확인할 수 없는 것들을 봅니다:
 *  - pdfjs가 **로컬 번들**에서 로드되는가 (CDN 제거 후)
 *  - 워커 파일이 실제로 해석되는가
 *  - CSP가 앱을 깨뜨리지 않는가 (위반은 콘솔에 찍힙니다)
 *  - PDF에서 텍스트가 추출되는가
 *
 * 왕복 테스트: **우리 렌더러가 만든 PDF를 우리 파서가 읽을 수 있는가.**
 * 못 읽으면 ATS도 못 읽습니다.
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:3600';
const DIR = process.argv[3] || '.';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? `\x1b[2m — ${detail}\x1b[0m` : ''}`);
};

const browser = await chromium.launch();
// 로케일을 고정합니다 — 지정하지 않으면 OS 언어를 따라가서, 이 하네스의
// 한국어 라벨('이름', '메시지를 입력하세요...') 검증이 머신에 따라 흔들립니다.
const page = await browser.newPage({ locale: 'ko-KR' });

/* ── 콘솔·네트워크 수집 ── */
const consoleErrors = [];
const cspViolations = [];
const requests = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') consoleErrors.push(t);
  if (/Content Security Policy|violates the following/i.test(t)) cspViolations.push(t);
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on('request', (r) => requests.push(r.url()));

/* ══════════ 1. 이력서 PDF 생성 (우리 인쇄 렌더러 → 실제 PDF) ══════════ */
console.log('\n\x1b[1m═══ 1. 우리 렌더러로 PDF 생성 ═══\x1b[0m');

const printHtml = readFileSync(`${DIR}/fixture-resume.html`, 'utf8');
const pdfPage = await browser.newPage();
await pdfPage.setContent(printHtml, { waitUntil: 'load' });
const pdfBuffer = await pdfPage.pdf({ format: 'Letter', printBackground: true });
await pdfPage.close();
writeFileSync(`${DIR}/fixture-resume.pdf`, pdfBuffer);
check('PDF 생성됨', pdfBuffer.length > 1000, `${pdfBuffer.length} bytes`);

/* ══════════ 2. /agent 로드 ══════════ */
console.log('\n\x1b[1m═══ 2. /agent 로드 + CSP ═══\x1b[0m');
await page.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });

check('페이지 로드', await page.getByPlaceholder('메시지를 입력하세요...').isVisible());
check('이력서 패널 렌더', await page.getByLabel('이름', { exact: true }).first().isVisible().catch(() => false));
check('CSP 위반 없음', cspViolations.length === 0, cspViolations.slice(0, 2).join(' | '));

/* ══════════ 3. pdfjs 출처 확인 ══════════ */
console.log('\n\x1b[1m═══ 3. pdfjs 로딩 출처 ═══\x1b[0m');
// 프리로드가 idle 시점에 돌도록 잠시 대기
await page.waitForTimeout(3000);
const cdnHits = requests.filter((u) => /cdn\.jsdelivr|unpkg|cdnjs/.test(u));
check('외부 CDN 요청 없음', cdnHits.length === 0, cdnHits.slice(0, 2).join(' | '));

/* ══════════ 4. PDF 업로드 → 텍스트 추출 ══════════ */
console.log('\n\x1b[1m═══ 4. PDF 업로드 → 텍스트 추출 ═══\x1b[0m');

// 파일 선택 (input[type=file]은 숨겨져 있으므로 직접 설정)
await page.setInputFiles('input[type="file"]', `${DIR}/fixture-resume.pdf`);

// 첨부 칩이 뜨면 추출 성공
const chip = page.locator('text=fixture-resume.pdf').first();
let attached = false;
try {
  await chip.waitFor({ state: 'visible', timeout: 20000 });
  attached = true;
} catch { /* 실패 */ }
check('PDF 파싱 성공 (첨부 칩 표시)', attached);

const workerReq = requests.filter((u) => /pdf\.worker/.test(u));
check('pdfjs 워커를 자기 오리진에서 로드', workerReq.length > 0 && workerReq.every((u) => u.startsWith(BASE)),
  workerReq[0] ? new URL(workerReq[0]).pathname : 'no worker request');

/* ══════════ 5. 이력서 패널 편집 + 내보내기 ══════════ */
console.log('\n\x1b[1m═══ 5. 패널 편집 + 내보내기 ═══\x1b[0m');

const nameField = page.getByLabel('이름', { exact: true }).first();
await nameField.fill('박지우');
await page.waitForTimeout(600); // 디바운스 저장 대기

const stored = await page.evaluate(() => localStorage.getItem('moa.resume.v1'));
check('편집 내용이 localStorage에 저장됨', !!stored && stored.includes('박지우'));

// 새로고침해도 살아남는가
await page.reload({ waitUntil: 'networkidle' });
const afterReload = await page.getByLabel('이름', { exact: true }).first().inputValue();
check('새로고침 후에도 유지', afterReload === '박지우', `"${afterReload}"`);

// 내보내기는 이름+이메일+내용이 모두 있어야 활성화됩니다.
await page.getByLabel('이메일', { exact: true }).first().fill('jiwoo@example.com');

// 학력 항목을 추가 (섹션 헤더의 "추가" 버튼)
await page.getByRole('button', { name: '추가' }).first().click();
await page.getByPlaceholder('학교').first().fill('Seoul National University');
await page.waitForTimeout(600);

const exportEnabled = await page.getByRole('button', { name: 'MD' }).isEnabled();
check('내용이 채워지면 내보내기가 활성화됨', exportEnabled);

let downloaded = null;
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: 'MD' }).click(),
  ]);
  downloaded = download.suggestedFilename();
} catch { /* 실패 */ }
check('MD 내보내기 동작', !!downloaded, downloaded ?? 'no download');
check('파일명에 한글 이름이 살아있음', !!downloaded && downloaded.includes('박지우'), downloaded ?? '');

/* ══════════ 6. 한국어 IME 조합 중 Enter ══════════
 * 조합을 확정하는 Enter(isComposing=true)가 메시지를 전송해 버리면
 * 마지막 음절이 입력창에 남는 고전적인 한국어 입력 버그가 됩니다.
 * 합성 KeyboardEvent로 가드를 검증합니다 — 모델 호출 없음(fetch를 막아 둠). */
console.log('\n\x1b[1m═══ 6. IME 조합 Enter 가드 ═══\x1b[0m');

const imeResult = await page.evaluate(async () => {
  const ta = document.querySelector('textarea');
  if (!ta) return null;
  // 가드가 회귀해도 실제 API 호출(과금)이 나가지 않도록 막습니다.
  window.fetch = () => new Promise(() => {});
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  setter.call(ta, '안녕하세요');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 50));

  ta.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }),
  );
  await new Promise((r) => setTimeout(r, 150));
  const afterComposing = ta.value;

  ta.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', isComposing: false, bubbles: true, cancelable: true }),
  );
  await new Promise((r) => setTimeout(r, 150));
  const afterPlain = ta.value;
  return { afterComposing, afterPlain };
});
check('IME 조합 중 Enter는 전송하지 않음', imeResult?.afterComposing === '안녕하세요', `"${imeResult?.afterComposing}"`);
check('일반 Enter는 전송함 (합성 이벤트 대조군)', imeResult?.afterPlain === '', `"${imeResult?.afterPlain}"`);

/* ══════════ 7. 다중 탭 이력서 동기화 ══════════
 * 같은 브라우저 컨텍스트(=같은 localStorage)의 두 탭에서, 한쪽의 편집이
 * storage 이벤트로 다른 쪽에 반영되는지 봅니다. 동기화가 없으면 탭마다
 * 메모리 사본이 따로 놀다가 마지막 저장이 다른 탭의 편집을 덮어씁니다. */
console.log('\n\x1b[1m═══ 7. 다중 탭 동기화 ═══\x1b[0m');

const syncCtx = await browser.newContext({ locale: 'ko-KR' });
const tabA = await syncCtx.newPage();
const tabB = await syncCtx.newPage();
await tabA.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
await tabB.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
await tabA.getByLabel('이름', { exact: true }).first().fill('동기화확인');
await tabA.waitForTimeout(800); // 디바운스 저장(400ms) + storage 이벤트 전파 여유
const syncedName = await tabB.getByLabel('이름', { exact: true }).first().inputValue();
check('탭 A의 편집이 탭 B에 반영됨 (storage 동기화)', syncedName === '동기화확인', `"${syncedName}"`);
await syncCtx.close();

/* ══════════ 8. 콘솔 에러 ══════════ */
console.log('\n\x1b[1m═══ 8. 콘솔 ═══\x1b[0m');
const realErrors = consoleErrors.filter(
  (e) => !/favicon|404 \(Not Found\)|Download the React DevTools/i.test(e),
);
check('콘솔 에러 없음', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n\x1b[1m═══ 브라우저 검증: ${passed}/${results.length} 통과 ═══\x1b[0m`);
if (passed !== results.length) {
  console.log('\x1b[31m실패:\x1b[0m');
  results.filter((r) => !r.pass).forEach((r) => console.log(`  · ${r.name} ${r.detail}`));
  process.exit(1);
}
