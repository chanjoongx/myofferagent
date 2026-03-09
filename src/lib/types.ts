// ===== My Offer Agent — 공유 타입 정의 =====
// API 요청/응답 + 도메인 모델. 프론트·백 양쪽에서 import.

// ---------- API 요청 ----------
export interface AgentRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId: string;
  resumeText?: string;        // 프론트에서 PDF 텍스트 추출 후 전달
  lastResponseId?: string;    // 이전 턴의 OpenAI response ID (대화 체인용)
  activeAgentName?: string;   // 현재 활성 에이전트 이름 (다음 턴 시작점)
  language?: 'ko' | 'en';    // 응답 언어 설정
}

// ---------- API 응답 ----------
export interface AgentResponse {
  output: string;
  activeAgent: string;
  structuredData: StructuredData;
  lastResponseId?: string;    // 이 턴의 response ID → 프론트가 다음 요청에 돌려보냄
  generatedFiles?: Array<{
    type: string;
    content: string;
    fileName: string;
  }>;
  error?: string;             // 서버 에러 시 에러 메시지
}

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
}

// ---------- 파싱된 이력서 ----------
export interface ParsedResume {
  contactInfo: {
    name: string;
    email: string;
    phone?: string;
    linkedin?: string;
    github?: string;
  };
  education: Array<{
    school: string;
    degree: string;
    major: string;
    gpa?: string;
    date: string;
  }>;
  experience: Array<{
    company: string;
    title: string;
    start: string;
    end: string;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    tech: string[];
    bullets: string[];
  }>;
  skills: {
    languages: string[];
    frameworks: string[];
    tools: string[];
  };
  targetRole?: string;
}
