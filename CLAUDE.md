# CLAUDE.md

myofferagent.com의 작업 기준 문서. **새 세션은 이 파일만 읽으면** 무엇이 돌아가고
있고, 어디를 보고, 어떻게 배포하고, 무엇을 조심할지 알 수 있어야 한다.

## 이 프로젝트

미국 취업을 준비하는 학생을 위한 AI 커리어 에이전트. 이력서 작성·ATS 분석·실시간
채용 검색·매칭·커버레터를 6개 에이전트가 한 채팅에서 처리한다.

- **스택**: Next.js 16 (App Router, React 19, React Compiler) + OpenAI Agents SDK
  + Zod v4 + Tailwind v4, Cloudflare Workers 배포.
- **프로덕션**: https://myofferagent.com (main 푸시 = 자동 배포).
- **저장소**: chanjoongx/myofferagent (public).

## 문서 지도 (역할이 겹치지 않게 유지할 것)

| 파일 | 역할 | 언어 |
|------|------|------|
| `CLAUDE.md` | **세션 시작점.** 현재 상태·배포·규칙·함정 | ko |
| `PROJECT.md` | 아키텍처 규칙·스펙의 정본, 폴더 구조 트리. 코드 생성 시 따를 제약 | ko |
| `TECHNICAL.md` | 시스템 전체 기술 문서 (요청 수명주기·도구·보안·배포·검증) | en |
| `README.md` | 공개 소개 (GitHub 첫 화면) | en |
| `scripts/verify/README.md` | 검증 하네스 4종 사용법 | ko |

**코드와 문서가 다르면 코드가 옳다.** 코드를 바꾸면 위 문서를 같은 커밋에서 고친다.

## 현재 상태

돌아왔을 때 실제 상태는 아래로 **직접 확인**한다 (이 절의 숫자는 스냅샷이라 낡을 수 있다):

```bash
git log --oneline -8            # 최근 작업
git status                      # 워킹 트리 (깨끗해야 정상)
git rev-parse HEAD origin/main  # 로컬 == 원격 이어야 함
```

배포된 버전이 최신 커밋인지 확인 (배포 실패는 조용하다 → 배포 절 참고):

```bash
curl -sS -D - -o /dev/null https://myofferagent.com/ | grep -i strict-transport
# 새 빌드의 헤더/경로가 보이면 라이브. 안 보이면 이전 버전이 계속 서빙 중일 수 있음.
```

**마지막 스냅샷 (2026-07-21):** 감사 + 수리에 이어 제품 개선 라운드 반영:
랜딩 한 화면 리디자인, 전 에이전트 날짜 그라운딩(dateRule) + Job Scout 신선도
규칙 + postedDate 파이프라인, PDF 추출 줄바꿈 보존, Triage→Match/Writer·
Analyzer→Match 핸드오프 확장, Scout에 get_resume.
검증 기준선(회귀 감지용): 유닛 **323** · browser **16** · a11y **21** ·
checkmarks **7** · e2e **33**. 프로덕션에 HSTS·COOP 헤더, workers.dev 비활성화 반영됨.
의도적으로 남긴 것(다음에 볼 만한 것)은 `TECHNICAL.md` §14와 memory 참고: 정적 자산
보안 헤더(`public/_headers` 필요), 오류 경로의 구조화 데이터 유실(신규 SSE 이벤트 필요),
incremental cache "dummy"(성능).

## 배포: GitHub → Cloudflare (전체 그림)

**푸시가 곧 배포다.** 별도 배포 명령을 사람이 칠 필요 없다.

```
git push origin main
  └─ Cloudflare Workers Builds (저장소에 연결됨, 트리거: main 브랜치)
       ├─ npm ci            (CF는 npm 10.9.2 사용, 의존성 규칙 참고)
       ├─ 빌드 명령: npm run cf:build
       │    └─ scripts/cf-build.mjs: .env* 4종을 잠시 치우고 OpenNext 빌드 →
       │       산출물에 시크릿이 구워졌는지 스캔(있으면 빌드 실패)
       ├─ 배포 명령: npx wrangler deploy
       └─ 커스텀 도메인 myofferagent.com이 새 버전을 서빙 (대시보드 관리)
```

- 정상 소요 **2~4분**. `wrangler deploy` 로그의 **"No targets deployed"는 정상**이다
  (workers.dev 비활성화 + 커스텀 도메인은 별도 반영). HSTS 등 새 마커로 라이브 확인.
- **런타임 시크릿**: `OPENAI_API_KEY`는 Worker 시크릿에만 산다
  (`npx wrangler secret put OPENAI_API_KEY`). 빌드 환경변수에는 절대 두지 않는다.
- **바인딩**(`wrangler.toml`): `RATE_LIMITER`(20/60s) · `ASSETS` · `[observability]`(Workers Logs)
  · `workers_dev=false` · `preview_urls=false`.
- **빌드 실패는 프로덕션에 흔적이 없다.** 이전 버전이 조용히 계속 서빙된다.
  푸시했는데 라이브가 안 바뀌면 폴링을 늘리지 말고 **Cloudflare Builds API로 상태·로그를
  직접 조회**한다 (cloudflare MCP, 워커 script `myofferagent`; 계정·식별자는 memory 참고).
- **비상 수동 배포**: `npm run cf:deploy` (로컬 build+deploy). Workers Builds와 **동시에
  쓰면 이중 배포**되니 평상시엔 쓰지 않는다.
- 대시보드 빌드 명령은 반드시 `npm run cf:build` (raw `npx @opennextjs/cloudflare build`
  금지: 시크릿 스캔 게이트가 빠진다).

### 푸시 전 필수 게이트 (순서대로)

```bash
npm run check          # typecheck + vitest 323 + next build (webpack). workerd는 검증 못 함
npm run cf:preview     # 실제 workerd, http://localhost:8787 (다른 터미널에서 유지)
npm run verify:local   # 하네스 4종: browser 16 / a11y 21 / checkmarks 7 / e2e 33
# 의존성을 바꿨다면:
npx npm@10.9.2 ci --dry-run    # CF의 npm ci가 받아들이는지 (아래 의존성 규칙)
git push origin main   # 게이트 통과 후 1회
npm run verify:prod    # 배포 후 프로덕션 a11y + e2e (실과금, 최종 1회)
```

## 절대 규칙

### 비용 (개인 OpenAI 키, 실제 과금)
- `e2e.mjs`·`verify-checkmarks.mjs`·`check:models`는 실제 모델을 호출한다.
  **로컬 workerd에서 먼저** 통과시키고, 프로덕션 풀 E2E는 배포 후 최종 1회만.
- 하네스 디버깅은 단일 시나리오로: `node scripts/verify/e2e.mjs <url> analyzer`.
- Job Scout 시나리오는 턴당 유료 웹 검색을 여러 번 태운다. 불필요하게 반복 금지.

### 의존성
- 추가·제거하면 푸시 전에 `npx npm@10.9.2 ci --dry-run`으로 락파일 동기화를 확인한다.
  CF는 npm 10.9.2의 `npm ci`를 쓰는데, 로컬 npm 11의 `uninstall`이 optional 전이
  의존성 항목을 락에서 빼먹어도 로컬은 무증상이다 (실측 2026-07-21: hono 제거가
  이 경로로 배포를 조용히 막았다).
- **락파일 통째 재생성 금지.** zod는 락에서 4.3.6 고정인데 `^4.3.6` 최신은 preprocess
  동작이 달라져 스키마 테스트 100건이 깨진다. 재생성이 불가피하면 zod를 4.3.6으로
  되돌리고 전체 테스트를 다시 확인한다.

## 이 환경의 함정 (전부 실측)
- 빌드는 반드시 `--webpack`. Turbopack 산출물은 OpenNext와 비호환 (배포 후 500으로 발현).
- wrangler를 죽여도 **workerd 자식은 살아남아** `.open-next` EPERM을 낸다.
  빌드 전 `Get-Process workerd` 확인, `Stop-Process -Name workerd -Force`로 정리.
- PowerShell 5.1: `&&` 없음, here-string은 큰따옴표에서 깨진다. 큰따옴표 있는
  커밋 메시지는 파일로 쓰고 `git commit -F <file>`.
- `browser.mjs`는 세 번째 인자로 픽스처 디렉터리(`scripts/verify`)가 필요하다.
- App Router는 `hydrateRoot(document)`라 전역 키 핸들러는 `e.target` 검사로 분기
  (stopPropagation으로는 같은 document의 React 리스너를 못 막는다).
- 색 대비 측정은 문자열 파싱이 아니라 1×1 canvas에 칠해 sRGB 픽셀을 읽는다.

## 이어서 작업할 때 (처음 5분)
1. 위 **현재 상태**의 명령으로 시작점과 라이브 버전을 확인한다.
2. 시스템 이해가 필요하면 `TECHNICAL.md`, 코드 제약·폴더 구조는 `PROJECT.md`.
3. 코드를 고쳤으면 위 **푸시 전 필수 게이트**를 순서대로. 푸시는 통과 후 1회.
4. 문서를 바꾸는 변경이라도 코드와의 정합을 먼저 확인한다 (코드가 옳다).
