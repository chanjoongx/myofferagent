// ===== My Offer Agent — 공유 타입 정의 =====
// API 요청/응답 + 도메인 모델. 프론트·백 양쪽에서 import.

import type { ResumeDocument } from './resume/schema';

/**
 * 한 요청에 담는 대화 이력의 상한 (클라이언트·서버 공용).
 * 서버는 이 개수만 사용하므로, 클라이언트가 그 이상을 보내는 것은
 * 대역폭 낭비일 뿐 아니라 긴 세션에서 본문 1MB 상한(413)에 걸려
 * 이후 모든 전송이 실패하는 원인이 됩니다.
 */
export const MAX_HISTORY_MESSAGES = 50;

// ---------- API 요청 ----------
export interface AgentRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  resumeText?: string;        // 프론트에서 PDF 텍스트 추출 후 전달
  /**
   * 클라이언트가 보관 중인 이력서 정본.
   * 서버는 무상태이므로, 매 턴 클라이언트가 되돌려 보내고 서버가 패치해 되돌려줍니다.
   * (사용자가 편집 패널에서 고친 내용도 이 경로로 에이전트에게 전달됩니다.)
   */
  resumeDoc?: ResumeDocument;
  lastResponseId?: string;    // 이전 턴의 OpenAI response ID (대화 체인용)
  activeAgentName?: string;   // 현재 활성 에이전트 이름 (다음 턴 시작점)
  language?: 'ko' | 'en';    // 응답 언어 설정
}

// ---------- API 응답 (스트림 종료 시 'done' 이벤트로 전달) ----------
export interface AgentResponse {
  output: string;
  activeAgent: string;
  /**
   * 이번 턴에 도구가 만들어 낸 구조화 데이터 **전부**.
   * 배열인 이유: Scout → Match 핸드오프가 한 번의 실행에서 일어나면
   * 공고 목록과 매칭 분석이 동시에 나옵니다. 단수였을 때는 한쪽이 조용히 버려졌습니다.
   */
  structuredData: StructuredData[];
  /**
   * 이번 턴에 **실제로 도구를 실행한** 에이전트 이름들.
   * 사이드바의 완료 체크에 씁니다 — 단순히 거쳐 간 것은 포함하지 않습니다.
   */
  completedAgents?: string[];
  /** 이번 턴에 이력서가 바뀐 경우에만 포함 */
  resumeDoc?: ResumeDocument;
  lastResponseId?: string;    // 이 턴의 response ID → 프론트가 다음 요청에 돌려보냄
  error?: string;             // 서버 에러 시 에러 메시지
}

// ---------- SSE 스트림 이벤트 ----------
/**
 * `/api/agent`는 SSE로 응답합니다. 각 줄은 `data: <JSON>\n\n` 형식이며
 * 페이로드는 아래 유니온 중 하나입니다.
 *
 * 기존에는 전체 실행이 끝날 때까지 기다렸다가 한 번에 JSON을 돌려줬습니다.
 * Job Scout가 웹 검색을 2~3회 수행하면 30~60초 동안 화면에는
 * 점 세 개만 튀는 상태였습니다.
 */
export type AgentStreamEvent =
  /** 활성 에이전트가 바뀜 (handoff 포함) */
  | { type: 'agent'; name: string }
  /** 도구 실행 시작 — 진행 상황 표시용 */
  | { type: 'tool_start'; tool: string }
  /** 도구 실행 완료 */
  | { type: 'tool_end'; tool: string }
  /** 응답 텍스트 조각 */
  | { type: 'delta'; text: string }
  /**
   * 이력서 변경분. 정상 종료 시에는 'done'에 실려 오지만,
   * **오류로 끝나는 경우에도** 편집분이 유실되지 않도록 별도로 먼저 보냅니다.
   */
  | { type: 'resume'; doc: ResumeDocument }
  /** 실행 완료 — 최종 페이로드 */
  | { type: 'done'; payload: AgentResponse }
  /** 복구 불가능한 오류 */
  | { type: 'error'; message: string };

// 구조화된 데이터 — discriminated union
export type StructuredData =
  | { type: 'ats_analysis'; data: ATSAnalysis }
  | { type: 'match_analysis'; data: MatchAnalysis }
  | { type: 'job_results'; data: JobSearchResult[] }
  | null;

// ---------- ATS 분석 ----------
export interface ATSSectionScore<MaxScore extends number = number> {
  score: number;
  maxScore: MaxScore;
}

export interface ATSAnalysis {
  overallScore: number; // 0–100
  sections: {
    formatCompatibility: ATSSectionScore<20> & {
      issues: string[];
      suggestions: string[];
    };
    keywordOptimization: ATSSectionScore<25> & {
      matched: string[];
      missing: string[];
    };
    achievementQuality: ATSSectionScore<20> & {
      weakBullets: string[];
      improved: string[];
    };
    structuralCompleteness: ATSSectionScore<15> & {
      present: string[];
      missing: string[];
    };
    readability: ATSSectionScore<10> & { issues: string[] };
    grammar: ATSSectionScore<10> & { errors: string[] };
  };
  topStrengths: string[];
  criticalImprovements: string[];
}

// ---------- 매칭 분석 ----------
export interface MatchAnalysis {
  matchScore: number; // 0–100
  keywordGap: {
    matched: string[];
    missing: string[];
  };
  skillMatch: {
    required: { met: string[]; unmet: string[]; percentage: number };
    preferred: { met: string[]; unmet: string[]; percentage: number };
  };
  resumeEdits: Array<{
    section: string;
    original: string;
    suggested: string;
    reason: string;
  }>;
}

// ---------- 채용공고 검색 결과 ----------
export interface JobSearchResult {
  company: string;
  position: string;
  location: string;
  type: 'remote' | 'onsite' | 'hybrid';
  url: string;
  requirements: string[];
  estimatedMatch: number;
  /**
   * 스폰서십 가능 여부. 서버 도구 스키마(analysis-tools.ts)가 수집합니다.
   * 이 앱의 주 사용자는 미국 취업 자격이 없는 한국 국적자라,
   * "no-sponsorship" 공고는 매칭률과 무관하게 지원할 수 없습니다.
   */
  sponsorship?: 'sponsors' | 'no-sponsorship' | 'unknown';
}

// ---------- 파싱된 이력서 ----------
// 이전의 느슨한 `ParsedResume`는 `lib/resume/schema.ts`의 `ResumeDocument`로
// 대체되었습니다. 그쪽이 Zod 스키마이자 정본이며, 리스트 항목에 id가 있어
// 부분 수정이 가능합니다.
export type { ResumeDocument } from './resume/schema';
