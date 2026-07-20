# CLAUDE.md

myofferagent.com의 작업 기준 문서입니다. 새 세션은 이 파일만 읽으면
어디를 보고 무엇을 조심해야 하는지 알 수 있어야 합니다.

## 이 프로젝트

AI 커리어 에이전트 (Next.js 16 + OpenAI Agents SDK, Cloudflare Workers).
프로덕션: https://myofferagent.com (main 푸시 = 자동 배포).

## 문서 지도 (역할이 겹치지 않게 유지할 것)

| 파일 | 역할 | 언어 |
|------|------|------|
| `CLAUDE.md` | 세션 시작점. 규칙·명령어·함정 요약 | ko |
| `PROJECT.md` | 아키텍처 규칙과 스펙의 정본. 코드 생성 시 따라야 할 제약 | ko |
| `TECHNICAL.md` | 시스템 전체 기술 문서 (요청 수명주기, 도구, 보안, 배포, 검증) | en |
| `README.md` | 공개 소개 (GitHub 첫 화면) | en |
| `scripts/verify/README.md` | 검증 하네스 4종 사용법 | ko |

코드와 문서가 다르면 **코드가 옳다.** 코드를 바꾸면 위 문서를 같은 커밋에서 고친다.

## 절대 규칙

### 비용 (개인 OpenAI 키, 실제 과금)

- `e2e.mjs`, `verify-checkmarks.mjs`, `check:models`는 실제 모델을 호출한다.
  **로컬 workerd에서 먼저** 통과시키고, 프로덕션 풀 E2E는 배포 후 최종 1회만.
- 하네스를 디버깅할 때는 단일 시나리오로: `node scripts/verify/e2e.mjs <url> analyzer`
- Job Scout 시나리오는 턴당 유료 웹 검색을 여러 번 태운다. 불필요하게 반복 실행 금지.

### 배포 (push가 곧 배포)

- `main` 푸시 → Cloudflare **Workers Builds**가 자동 빌드·배포 (정상 2~4분).
  `npm run cf:deploy` 직접 실행 금지 (이중 배포).
- **푸시 전 필수 게이트**: `npm run check` 녹색 + `npm run cf:preview` 위에서
  `npm run verify:local` 전부 통과. `npm run check`는 workerd를 전혀 검증하지 않는다.
- 배포 확인은 20초 이상 간격의 단일 루프로. 실패가 의심되면 폴링을 늘리지 말고
  Cloudflare Builds API로 빌드 상태·로그를 직접 조회한다 (실측: 빌드 실패는
  프로덕션에 아무 흔적을 남기지 않고, 이전 버전이 조용히 계속 서빙된다).

### 의존성

- 의존성을 추가·제거하면 푸시 전에 `npx npm@10.9.2 ci --dry-run`으로 락파일
  동기화를 확인한다. CF 빌드는 npm 10.9.2의 `npm ci`를 쓰는데, 로컬 npm 11의
  `uninstall`이 optional 전이 의존성 항목을 락에서 빼먹어도 로컬에서는 아무
  증상이 없다 (실측 2026-07-21: hono 제거가 이 경로로 배포를 조용히 막았다).
- **락파일을 통째로 재생성하지 말 것.** zod는 락에서 4.3.6에 고정되어 있는데,
  `^4.3.6` 범위의 최신 zod는 preprocess/transform 동작이 달라져 스키마 테스트
  100건이 깨진다 (실측 2026-07-21). 재생성이 불가피하면 zod를 4.3.6으로 되돌리고
  전체 테스트를 다시 확인한다.

## 검증 파이프라인

```bash
npm run check          # typecheck + vitest 309 + next build (webpack 강제)
npm run cf:preview     # 실제 workerd, http://localhost:8787
npm run verify:local   # 하네스 4종: browser 16 / a11y 21 / checkmarks 7 / e2e 33
npm run verify:prod    # 배포 후 1회: 프로덕션 a11y + e2e (실과금)
npm run check:models   # 모델 변경 시에만 (실과금)
```

## 이 환경의 함정 (전부 실측)

- 빌드는 반드시 `--webpack`. Turbopack 산출물은 OpenNext와 비호환 (배포 후 500으로 발현).
- wrangler를 죽여도 **workerd 자식은 살아남아** `.open-next` EPERM을 낸다.
  빌드 전 `Get-Process workerd` 확인, `Stop-Process -Name workerd -Force`로 정리.
- PowerShell 5.1: `&&` 없음. 커밋 메시지에 큰따옴표가 들어가면 here-string이
  깨지므로 파일로 쓰고 `git commit -F <file>`.
- `browser.mjs`는 세 번째 인자로 픽스처 디렉터리(`scripts/verify`)가 필요하다.
- App Router는 `hydrateRoot(document)`라 전역 키 핸들러는 `e.target` 검사로 분기
  (stopPropagation으로는 같은 document의 React 리스너를 못 막는다).
- 색 대비 측정은 문자열 파싱이 아니라 1×1 canvas에 칠해 sRGB 픽셀을 읽는다.

## 이어서 작업할 때

1. `git log --oneline -10`과 `git status`로 시작점 확인.
2. 마지막 배포가 최신 커밋인지 확인 (배포 실패는 조용하다. 위 배포 절 참고).
3. 시스템 이해가 필요하면 `TECHNICAL.md`, 코드 제약은 `PROJECT.md`.
4. 코드를 고쳤으면 위 검증 파이프라인 순서대로. 푸시는 게이트 통과 후 1회.
