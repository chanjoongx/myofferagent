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
| 프레임워크 | Next.js (App Router) | 16.1.x |
| 에이전트 | @openai/agents (TypeScript) | 0.6.x |
| LLM | gpt-4o (standard), gpt-4o-mini (fast) | — |
| 스타일링 | Tailwind CSS | v4 |
| 검증 | Zod | v4 |
| 마크다운 | react-markdown | — |
| PDF 파싱 | pdfjs-dist (CDN 동적 로드, 런타임 4.9.x) | — |
| 아이콘 | lucide-react | — |
| 서버 보호 | server-only (tools.ts 보호) | — |
| 배포 | Cloudflare Pages (@opennextjs/cloudflare + wrangler) | — |

## 프레임워크 주의사항

### Next.js 16

- Turbopack이 기본 번들러지만, 이 프로젝트는 호환성 문제로 `next dev --webpack` 사용 중.
- React Compiler 활성화 (`next.config.ts`의 `reactCompiler: true` + `babel-plugin-react-compiler`)
- `serverExternalPackages: ["pdfjs-dist"]` — 서버에서 canvas 참조 에러 방지
- `next build`에서 linter 자동 실행 안 함

### Tailwind v4

- `tailwind.config.ts` **없음**. CSS-first 설정만 사용.
- 테마 설정은 CSS 파일에서 `@import "tailwindcss"` + `@theme { }` 디렉티브
- `bg-gradient-to-*` → `bg-linear-to-*` (v4 정식 이름)
- PostCSS: `postcss.config.mjs`에서 `@tailwindcss/postcss` 플러그인 사용

### @openai/agents SDK (TypeScript)

- 공식 문서: https://openai.github.io/openai-agents-js/
- Zod v4 필수 의존성
- 핵심 API:
  ```typescript
  import { Agent, run, handoff, webSearchTool } from '@openai/agents';
  import { z } from 'zod';
  ```
- `Agent.create()` 사용 (handoff 체인에서 타입 추론)
- `run(agent, input, options?)` 으로 실행 (Runner 직접 사용 안 함)
- 결과: `result.finalOutput` (string | z.infer), `result.newItems` (실행 이벤트 배열)
- **에이전트 추적**: `result.newItems`에서 `RunHandoffOutputItem`으로 마지막 핸드오프 대상 확인
- **대화 체인**: `result.lastResponseId` (런타임 존재) → 다음 턴에서 `previousResponseId`로 전달
- hosted tool: `webSearchTool()` (import 후 배열에 추가)
- function tool: `tool()` 헬퍼 + Zod 스키마

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
│   │           └── route.ts        ← [백엔드] 에이전트 API + 스마트 라우팅
│   ├── lib/
│   │   ├── types.ts                ← API 요청/응답 + 도메인 타입 (프론트·백 공유)
│   │   ├── i18n.ts                 ← 다국어 번역 키 (ko/en)
│   │   ├── i18n-context.tsx        ← 다국어 React Context
│   │   ├── theme-context.tsx       ← 다크/라이트 테마 Context
│   │   ├── url-utils.ts            ← isSafeUrl() 공유 유틸 (XSS 방지)
│   │   └── agents/
│   │       ├── constants.ts        ← ⚠️ AGENT_NAMES 상수 + AgentName 타입 (client-safe)
│   │       ├── definitions.ts      ← 6개 에이전트 정의 (bottom-up 순서)
│   │       ├── tools.ts            ← ⚠️ import 'server-only' — callOpenAI(재시도+Zod검증) + 3개 도구
│   │       ├── model-config.ts     ← MODEL_CONFIG (fast/standard 모델명 중앙 관리)
│   │       └── index.ts            ← re-export (constants + definitions)
│   └── components/
│       ├── pdf-loader.ts           ← pdfjs-dist 동적 로드
│       ├── chat/
│       │   ├── ChatInterface.tsx    ← 메인 채팅 UI (메시지, 입력, 상태)
│       │   ├── MessageBubble.tsx    ← react-markdown 기반 메시지 렌더링
│       │   └── AgentStatusPanel.tsx ← 사이드바 에이전트 상태 표시
│       ├── resume/
│       │   ├── ResumeUploader.tsx   ← PDF 드래그앤드롭 업로드
│       │   └── ATSScoreCard.tsx     ← ATS 분석 결과 시각화
│       ├── jobs/
│       │   └── JobCard.tsx          ← 채용공고 카드 컴포넌트
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

- `tools.ts` 첫 줄에 `import 'server-only'` — 서버 전용 코드(API 키 등) 보호
- `index.ts`는 `tools.ts`를 transitively import → client 컴포넌트에서 import 금지
- **client 컴포넌트**에서 에이전트 이름이 필요하면 → `@/lib/agents/constants` 에서 import
- **server 코드**(route.ts 등)에서는 `@/lib/agents` (= index.ts)에서 import 가능

### 2. 서버사이드 스마트 라우팅 (route.ts)

LLM 기반 Triage 라우팅은 비결정적이므로, **route.ts에서 정규식으로 1차 라우팅** 후 LLM fallback:

```
첫 메시지 (lastResponseId 없음):
  wantsSearch (채용|공고|검색|찾아|인턴|...) → Job Scout 직접 시작
  wantsAnalyze (이력서+분석|ATS|...) → Resume Analyzer 직접 시작
  wantsBuild (이력서+만들|작성|없|...) → Resume Builder 직접 시작
  그 외 → Triage Agent (LLM 라우팅)

기존 세션 (lastResponseId 있음):
  Job Scout + 공고번호 선택 → Match Strategy로 전환
  검색 불가 에이전트 + 검색 요청 → Job Scout로 보정
```

### 3. Job Scout → Match Strategy 전환

- Job Scout의 `handoffs: []` — **빈 배열** (LLM 핸드오프 제거됨)
- 이유: LLM(gpt-4o)이 비결정적으로 web_search 대신 즉시 handoff를 호출하는 버그 방지
- Job Scout → Match Strategy 전환은 **route.ts 서버사이드**에서 처리:
  - 사용자가 "2번 분석해줘" 등 공고 번호를 선택하면 정규식으로 감지 → Match Strategy로 라우팅
  - `previousResponseId`를 통해 대화 컨텍스트가 자동 유지됨

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

| # | 에이전트 | model | 역할 | 도구 | handoff 대상 |
|---|---------|-------|------|------|-------------|
| 0 | triageAgent | gpt-4o | 의도 파악 후 라우팅 | 없음 | builder, analyzer, scout |
| 1 | resumeBuilderAgent | gpt-4o | 대화형 이력서 작성 | generateResumeMarkdown | analyzer |
| 2 | resumeAnalyzerAgent | gpt-4o | ATS 100점 분석 | parseResumeText, calculateATSScore | scout |
| 3 | jobScoutAgent | gpt-4o | 채용공고 웹 검색 | webSearchTool() | **없음** (서버사이드 전환) |
| 4 | matchStrategyAgent | gpt-4o | 이력서-JD 매칭 분석 | 없음 | writer |
| 5 | applicationWriterAgent | gpt-4o | 커버레터/최적화 이력서 | generateResumeMarkdown | 없음 |

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
  fast: 'gpt-4o-mini',     // 파싱, 마크다운 생성 등
  standard: 'gpt-4o',      // 분석, 매칭, 검색, 라우팅 등
} as const;
```

## API 스펙

### POST /api/agent

Request:
```typescript
interface AgentRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  resumeText?: string;        // 프론트에서 PDF 텍스트 추출 후 전달
  lastResponseId?: string;    // 이전 턴의 OpenAI response ID (대화 체인용)
  activeAgentName?: string;   // 현재 활성 에이전트 이름 (다음 턴 시작점)
  language?: 'ko' | 'en';    // 응답 언어 설정
}
```

Response:
```typescript
interface AgentResponse {
  output: string;
  activeAgent: string;
  structuredData: StructuredData;
  lastResponseId?: string;    // 이 턴의 response ID → 프론트가 다음 요청에 돌려보냄
  generatedFiles?: Array<{ type: string; content: string; fileName: string }>;
  error?: string;             // 서버 에러 시 에러 메시지
}

type StructuredData =
  | { type: 'ats_analysis'; data: ATSAnalysis }
  | { type: 'match_analysis'; data: MatchAnalysis }
  | { type: 'job_results'; data: JobSearchResult[] }
  | null;
```

### 요청 제한

- `MAX_MESSAGES = 50` — messages 배열 자동 truncation
- `MAX_BODY_SIZE = 500_000` — 초과 시 413 응답
- **인메모리 Rate Limiting**: 60초 윈도우, 최대 20회/IP

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

interface ParsedResume {
  contactInfo: { name: string; email: string; phone?: string; linkedin?: string; github?: string };
  education: Array<{ school: string; degree: string; major: string; gpa?: string; date: string }>;
  experience: Array<{ company: string; title: string; start: string; end: string; bullets: string[] }>;
  projects: Array<{ name: string; tech: string[]; bullets: string[] }>;
  skills: { languages: string[]; frameworks: string[]; tools: string[] };
  targetRole?: string;
}
```

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

## 완성 상태 (2026년 3월 기준)

### 완성됨
- 채팅 기본 플로우 (Triage → Builder/Analyzer/Scout handoff)
- 서버사이드 스마트 라우팅 (route.ts 정규식 기반)
- PDF 첨부 + ATS 분석 (ScoreCard 시각화)
- PDF 첨부 시 채팅에 파일명 카드 표시
- 이력서/커버레터 다운로드 버튼 (마크다운 감지 → .md 다운로드 + generatedFiles + PDF 인쇄)
- 이력서 PDF 저장 (window.print 기반, 의존성 0)
- 채용공고 검색 (Job Scout + webSearchTool)
- react-markdown 기반 메시지 렌더링 (테이블 가로스크롤 대응)
- 다국어 (ko/en) 전환
- 다크/라이트 테마 전환
- 반응형 모바일 최적화 (모바일 drawer, visualViewport 키보드 대응)
- 로딩 타이핑 인디케이터 (바운싱 dots 애니메이션)
- ARIA 접근성 (role, aria-live, aria-label)
- XSS 방지 (isSafeUrl, 입력 sanitize)
- 요청 제한 (body size, message count, rate limiting)
- Zod 런타임 스키마 검증 (ParsedResume, ATSAnalysis)
- server-only 보호 (tools.ts)
- 에이전트 이름 상수화 (AGENT_NAMES)
- Cloudflare 배포 설정 (wrangler.toml, open-next.config.ts)
- MIT LICENSE
- 사이드바 에이전트 클릭 수동 전환 (lastResponseId 리셋 + 시스템 메시지)
- Scout → Match 라우팅 확장 (숫자 입력, 다양한 한국어/영어 표현)
- 커버레터 요청 → Writer 직접 라우팅

### 미완성 / TODO
- [ ] 전체 5단계 체인 end-to-end 동작 검증 (런타임 테스트)
