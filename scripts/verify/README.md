# 검증 하네스

`npm run check`(타입·유닛·next build)로는 잡히지 않는 것들을 **실제 브라우저와
실제 workerd**에서 확인합니다. `npm run check`는 workerd를 전혀 검증하지 않고,
과거에 그 틈으로 프로덕션 장애가 한 번 났습니다.

## 실행 순서

```bash
# 1) 실제 workerd 띄우기 (다른 터미널)
npm run cf:preview                    # cf:build + wrangler dev

# 2) 로컬 workerd 대상으로 4종 전부
npm run verify:local

# 3) 배포 후 프로덕션 최종 확인 (풀 E2E는 1회만, 실제 과금)
npm run verify:prod
```

개별 실행이 필요하면:

```bash
node scripts/verify/browser.mjs          http://localhost:8787 scripts/verify
node scripts/verify/verify-a11y.mjs      http://localhost:8787
node scripts/verify/verify-checkmarks.mjs http://localhost:8787
node scripts/verify/e2e.mjs              http://localhost:8787 all   # 시나리오 하나만: all 대신 이름
```

## 각각 무엇을 보는가

| 스크립트 | 검증 항목 | 기준선 |
|---|---|---|
| `browser.mjs` | pdfjs 로컬 로딩(CDN 금지), CSP 위반, PDF 왕복(우리가 만든 PDF를 우리가 파싱), 패널 편집·영속화·내보내기, IME 조합 Enter 가드, 다중 탭 동기화 | 16건 |
| `verify-a11y.mjs` | 핀치 줌, 첫 페인트 전 테마/언어 확정, placeholder 대비, 모바일 모달 시맨틱(포커스 트랩·Escape·포커스 복귀) | 21건 |
| `verify-checkmarks.mjs` | 사이드바 완료 체크가 **실제로 일한** 에이전트에만 찍히는지 | 7건 |
| `e2e.mjs` | 에이전트 라우팅·도구 호출·이력서 정본 왕복·영어 로케일·프롬프트 인젝션 저항 | 33건 |

## 주의

- **`e2e.mjs`와 `verify-checkmarks.mjs`는 실제 모델을 호출합니다.** 개인 OpenAI 키에
  과금됩니다. 하네스를 고치는 중이면 시나리오 하나만 지정해 반복하세요.
- `browser.mjs`는 세 번째 인자로 픽스처 디렉터리가 필요합니다(`fixture-resume.html`을
  읽고 `fixture-resume.pdf`를 생성). 위 예시처럼 `scripts/verify`를 넘기세요.
- 색상 대비는 `oklch()`로 계산되어 나오므로 문자열 파싱이 아니라 1×1 캔버스에 칠해
  sRGB 픽셀을 읽습니다. 직접 숫자를 파싱하면 엉뚱한 값이 나옵니다.
