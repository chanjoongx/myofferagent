/**
 * 이번 라운드에서 고친 것들의 실제 브라우저 검증
 *  - 핀치 줌 허용 (WCAG 1.4.4)
 *  - 첫 페인트 전 테마/언어 확정 (하이드레이션 깜빡임)
 *  - placeholder 대비 4.5:1
 *  - 모바일 이력서 패널의 모달 시맨틱 (dialog / 포커스 트랩 / Escape / 포커스 복귀)
 *  - 데스크톱에서는 모달이 **아니어야** 함
 *  - app-shell 레이아웃 (사이드바가 채팅 위로 쌓이지 않음)
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8787';
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(
    `  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? `\x1b[2m — ${detail}\x1b[0m` : ''}`,
  );
};

/* WCAG 상대 휘도 대비 */
function contrast(rgb1, rgb2) {
  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const [a, b] = [lum(rgb1), lum(rgb2)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const parseRgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);

const browser = await chromium.launch();

/* ════════ 1. 뷰포트 메타 — 줌 차단 해제 ════════ */
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/agent`, { waitUntil: 'domcontentloaded' });
  const vp = await page.getAttribute('meta[name="viewport"]', 'content');
  check(
    '핀치 줌 허용 (user-scalable=no / maximum-scale 없음)',
    !/user-scalable\s*=\s*no/i.test(vp || '') && !/maximum-scale/i.test(vp || ''),
    vp,
  );
  await page.close();
}

/* ════════ 2. 첫 페인트 전 테마 확정 ════════
   Next의 JS 번들을 **전부 차단**하고 로드합니다.
   React가 아예 없으므로, html에 클래스를 붙일 수 있는 것은
   <head>의 인라인 스크립트뿐입니다. 이게 되면 깜빡임이 없다는 증명입니다. */
{
  const page = await browser.newPage();
  await page.route('**/_next/static/**/*.js', (r) => r.abort());
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('locale', 'en');
  });
  await page.goto(`${BASE}/agent`, { waitUntil: 'domcontentloaded' });
  const state = await page.evaluate(() => ({
    cls: document.documentElement.className,
    scheme: document.documentElement.style.colorScheme,
    lang: document.documentElement.lang,
  }));
  check(
    'JS 번들 없이도 라이트 테마 적용 (인라인 스크립트가 페인트 전 처리)',
    state.cls.includes('light') && !state.cls.includes('dark'),
    `class="${state.cls}" colorScheme=${state.scheme}`,
  );
  check('JS 번들 없이도 언어 적용', state.lang === 'en', `lang=${state.lang}`);
  await page.close();
}

/* ════════ 3. 하이드레이션 오류 없음 ════════ */
{
  const page = await browser.newPage();
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const hydration = errs.filter((e) =>
    /hydrat|did not match|Text content does not match|server rendered HTML/i.test(e),
  );
  check('하이드레이션 불일치 없음', hydration.length === 0, hydration[0]?.slice(0, 160) || '');

  const csp = errs.filter((e) => /Content Security Policy/i.test(e));
  check('CSP 위반 없음', csp.length === 0, csp[0]?.slice(0, 160) || '');
  await page.close();
}

/* ════════ 4. placeholder 대비 ════════ */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      const d = document.documentElement;
      d.classList.remove('light', 'dark');
      d.classList.add(t);
    }, theme);
    await page.waitForTimeout(200);

    const measured = await page.evaluate(() => {
      /* 이 앱의 색은 oklch()로 계산되어 나옵니다. 직접 파싱하면 안 되고
       * (숫자를 RGB로 오해합니다) 브라우저가 실제로 칠하는 sRGB 값을 봐야 합니다.
       * 1×1 캔버스에 칠하고 픽셀을 읽으면 그게 화면에 나가는 바로 그 값입니다. */
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const toRgb = (css) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      };

      const el = document.querySelector('aside input[placeholder]');
      if (!el) return null;
      const phCss = getComputedStyle(el, '::placeholder').color;
      // 실제 뒤 배경을 찾습니다 (투명한 조상은 건너뜁니다)
      let node = el, bgCss = 'rgba(0, 0, 0, 0)';
      while (node) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bgCss = c; break; }
        node = node.parentElement;
      }
      return { ph: toRgb(phCss), bg: toRgb(bgCss), phCss, bgCss };
    });

    if (!measured) { check(`placeholder 대비 (${theme})`, false, '입력 필드를 찾지 못함'); continue; }
    const ratio = contrast(measured.ph, measured.bg);
    check(
      `placeholder 대비 ≥ 4.5:1 (${theme})`,
      ratio >= 4.5,
      `${ratio.toFixed(2)}:1  ${measured.phCss} on ${measured.bgCss}`,
    );
  }
  await page.close();
}

/* ════════ 5. 데스크톱: 모달이 아니어야 함 + 레이아웃 ════════ */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const aside = page.locator('aside[aria-label="이력서"]');
  check('데스크톱: 이력서 패널이 dialog가 아님', (await aside.getAttribute('role')) === null);
  check('데스크톱: aria-modal 없음', (await aside.getAttribute('aria-modal')) === null);

  /* app-shell: 사이드바와 채팅이 가로로 나란히 (세로로 쌓이면 회귀) */
  const geo = await page.evaluate(() => {
    const nav = document.querySelector('aside, nav');
    const asideEl = document.querySelector('aside[aria-label="이력서"]');
    const main = document.querySelector('main') || asideEl?.previousElementSibling;
    return {
      panel: asideEl?.getBoundingClientRect().toJSON(),
      main: main?.getBoundingClientRect().toJSON(),
      docScrollW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
    };
  });
  check(
    '데스크톱: 이력서 패널이 본문 오른쪽에 나란히',
    !!geo.panel && !!geo.main && geo.panel.left >= geo.main.right - 2,
    geo.panel ? `panel.left=${Math.round(geo.panel.left)} main.right=${Math.round(geo.main.right)}` : '',
  );
  check('가로 스크롤 없음', geo.docScrollW <= geo.winW + 1, `${geo.docScrollW} vs ${geo.winW}`);
  await page.close();
}

/* ════════ 6. 모바일: 진짜 모달 ════════ */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${BASE}/agent`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const toggle = page.locator('button[aria-label="이력서 보기"]');
  check('모바일: 이력서 토글 버튼 존재', (await toggle.count()) > 0);

  if ((await toggle.count()) > 0) {
    await toggle.first().click();
    await page.waitForTimeout(400);

    const aside = page.locator('aside[aria-label="이력서"]');
    check('모바일: role="dialog"', (await aside.getAttribute('role')) === 'dialog');
    check('모바일: aria-modal="true"', (await aside.getAttribute('aria-modal')) === 'true');

    const focusInside = await page.evaluate(() => {
      const panel = document.querySelector('aside[aria-label="이력서"]');
      return !!panel && panel.contains(document.activeElement);
    });
    check('모바일: 열릴 때 포커스가 패널 안으로 이동', focusInside);

    const locked = await page.evaluate(() => document.body.style.overflow);
    check('모바일: 배경 스크롤 잠금', locked === 'hidden', `overflow=${locked}`);

    /* 포커스 트랩 — Tab을 많이 눌러도 패널 밖으로 못 나감 */
    let escaped = false;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const panel = document.querySelector('aside[aria-label="이력서"]');
        return !!panel && panel.contains(document.activeElement);
      });
      if (!inside) { escaped = true; break; }
    }
    check('모바일: Tab 포커스 트랩 (40회 순회)', !escaped);

    /* 입력 필드 안에서 Escape → 패널은 닫히지 않고 블러만 */
    await page.locator('aside[aria-label="이력서"] input').first().focus();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(
      '모바일: 입력 중 Escape는 블러만 (패널 유지)',
      (await aside.getAttribute('aria-modal')) === 'true',
    );

    /* 패널 본체에서 Escape → 닫힘 + 포커스 복귀 */
    await page.locator('aside[aria-label="이력서"]').first().click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    const closed = await page.evaluate(() => {
      const panel = document.querySelector('aside[aria-label="이력서"]');
      return {
        modal: panel?.getAttribute('aria-modal'),
        overflow: document.body.style.overflow,
        activeLabel: document.activeElement?.getAttribute('aria-label'),
      };
    });
    check('모바일: Escape로 닫힘', closed.modal === null, `aria-modal=${closed.modal}`);
    check('모바일: 스크롤 잠금 해제', closed.overflow !== 'hidden', `overflow=${closed.overflow}`);
    check(
      '모바일: 닫은 뒤 포커스가 토글 버튼으로 복귀',
      closed.activeLabel === '이력서 보기',
      `activeElement aria-label=${closed.activeLabel}`,
    );
  }
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${failed.length === 0 ? '\x1b[32m' : '\x1b[31m'}${results.length - failed.length}/${results.length} 통과\x1b[0m`,
);
process.exit(failed.length === 0 ? 0 : 1);
