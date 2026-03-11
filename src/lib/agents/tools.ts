import 'server-only';

import { tool } from '@openai/agents';
import { z } from 'zod';
import { MODEL_CONFIG } from './model-config';

/* ── 제한 상수 ── */
const MAX_TEXT_INPUT = 50_000; // 도구 입력 문자열 최대 길이
const MAX_RETRIES = 2;         // API 재시도 횟수
const RETRY_BASE_MS = 1_000;   // 재시도 기본 대기 시간 (ms)

/* ── Zod 런타임 검증 스키마 ── */

/** ParsedResume 최상위 구조 검증 (세부 필드는 passthrough로 유연하게 허용) */
const ParsedResumeSchema = z.object({
  contactInfo: z.object({
    name: z.string(),
    email: z.string(),
  }).passthrough(),
  education: z.array(z.object({}).passthrough()),
  experience: z.array(z.object({}).passthrough()),
  projects: z.array(z.object({}).passthrough()),
  skills: z.object({}).passthrough(),
}).passthrough();

/** ATSAnalysis 구조 검증 — 점수와 섹션 존재 여부를 런타임에서 확인 */
const ATSAnalysisSchema = z.object({
  overallScore: z.number(),
  sections: z.object({
    formatCompatibility: z.object({ score: z.number(), maxScore: z.number() }).passthrough(),
    keywordOptimization: z.object({ score: z.number(), maxScore: z.number() }).passthrough(),
    achievementQuality: z.object({ score: z.number(), maxScore: z.number() }).passthrough(),
    structuralCompleteness: z.object({ score: z.number(), maxScore: z.number() }).passthrough(),
    readability: z.object({ score: z.number(), maxScore: z.number() }).passthrough(),
    grammar: z.object({ score: z.number(), maxScore: z.number() }).passthrough(),
  }),
  topStrengths: z.array(z.string()),
  criticalImprovements: z.array(z.string()),
});

/* ── OpenAI API 호출 헬퍼 ── */

interface CallOpenAIOptions {
  /** 응답 포맷. 기본값 'json_object'. 마크다운 등 비-JSON은 null */
  responseFormat?: { type: string } | null;
  /** 생성 온도. 기본값 0.3 */
  temperature?: number;
}

/**
 * OpenAI Chat Completions API 호출 (재시도 포함).
 * 도구들이 공통으로 사용하는 헬퍼 함수.
 */
async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  model: string = MODEL_CONFIG.fast,
  options: CallOpenAIOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다');

  const { responseFormat = { type: 'json_object' }, temperature = 0.3 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
      };

      // responseFormat이 null이면 response_format 생략 (마크다운 등 자유 형식)
      if (responseFormat) {
        body.response_format = responseFormat;
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.text();

        // 429(Rate limit) 또는 5xx → 재시도 대상
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt);
          console.log(`[callOpenAI] ${res.status} → ${delay}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));
          lastError = new Error(`OpenAI API 호출 실패 (${res.status})`);
          continue;
        }

        console.error(`[callOpenAI] ${res.status} 에러:`, errorBody);
        throw new Error(`OpenAI API 호출 실패 (${res.status})`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('OpenAI 응답에 유효한 content가 없습니다');
      }
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 네트워크 에러 등 → 재시도
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        console.log(`[callOpenAI] 에러 → ${delay}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError ?? new Error('OpenAI API 호출 실패');
}

/*
 * ─── Tool 1: parseResumeText ───
 * 이력서 원문 → ParsedResume 구조화 JSON
 */
export const parseResumeText = tool({
  name: 'parse_resume_text',
  description:
    '이력서 텍스트를 받아 구조화된 JSON(ParsedResume)으로 파싱합니다. 연락처, 학력, 경력, 프로젝트, 스킬 등을 추출합니다.',
  parameters: z.object({
    text: z.string().max(MAX_TEXT_INPUT).describe('이력서 원문 텍스트'),
    targetRole: z.string().max(200).default('').describe('지원 목표 직무 (있을 경우)'),
  }),
  execute: async (input): Promise<string> => {
    const systemPrompt = `당신은 이력서 파싱 전문가입니다.
주어진 이력서 텍스트를 아래 JSON 스키마에 맞게 구조화하세요.
빈 필드는 빈 문자열이나 빈 배열로 채우되, 추측하지 마세요.

JSON Schema:
{
  "contactInfo": { "name": string, "email": string, "phone?": string, "linkedin?": string, "github?": string },
  "education": [{ "school": string, "degree": string, "major": string, "gpa?": string, "date": string }],
  "experience": [{ "company": string, "title": string, "start": string, "end": string, "bullets": string[] }],
  "projects": [{ "name": string, "tech": string[], "bullets": string[] }],
  "skills": { "languages": string[], "frameworks": string[], "tools": string[] },
  "targetRole?": string
}

반드시 유효한 JSON만 출력하세요.`;

    const sanitizedRole = input.targetRole.replace(/[\n\r]/g, ' ').slice(0, 200);
    const userMsg = sanitizedRole.length > 0
      ? `[목표 직무: ${sanitizedRole}]\n\n${input.text}`
      : input.text;

    try {
      const result = await callOpenAI(systemPrompt, userMsg);

      // Zod 런타임 검증
      const parsed = JSON.parse(result);
      const validation = ParsedResumeSchema.safeParse(parsed);
      if (!validation.success) {
        console.error('[parseResumeText] 스키마 검증 실패:', validation.error.issues);
        throw new Error('파싱 결과가 예상 스키마와 일치하지 않습니다.');
      }

      console.log('[parseResumeText] 파싱 및 검증 성공');
      return result;
    } catch (err) {
      console.error('[parseResumeText] 실패:', err);
      throw new Error('이력서 파싱에 실패했습니다. 텍스트를 확인해주세요.');
    }
  },
});

/*
 * ─── Tool 2: calculateATSScore ───
 * ParsedResume + 목표직무 → ATS 100점 분석 리포트
 */
export const calculateATSScore = tool({
  name: 'calculate_ats_score',
  description:
    'ParsedResume JSON과 타겟 직무를 기반으로 ATS 호환성을 100점 만점으로 분석합니다. 6개 섹션별 점수와 개선 제안을 생성합니다.',
  parameters: z.object({
    resumeJson: z.string().max(MAX_TEXT_INPUT).describe('ParsedResume JSON 문자열'),
    targetRole: z.string().max(200).default('').describe('지원 목표 직무'),
  }),
  execute: async (input): Promise<string> => {
    const role = (input.targetRole || 'Software Engineer').replace(/[\n\r]/g, ' ').slice(0, 200);

    const systemPrompt = `당신은 ATS(Applicant Tracking System) 분석 전문가입니다.
주어진 이력서 JSON을 분석하여 아래 형식의 ATS 점수를 생성하세요.
목표 직무: ${role}

각 섹션의 만점과 평가 기준:
1. formatCompatibility (maxScore: 20) — ATS 파서 호환성, 표/이미지 없는지, 섹션 헤더 표준 여부
2. keywordOptimization (maxScore: 25) — 직무 관련 키워드 포함률, 하드스킬/소프트스킬 매칭
3. achievementQuality (maxScore: 20) — 정량적 성과(숫자) 포함, STAR 형식 활용
4. structuralCompleteness (maxScore: 15) — 필수 섹션(연락처/학력/경력/스킬) 존재 여부
5. readability (maxScore: 10) — 글머리 길이, 일관된 시제, 간결성
6. grammar (maxScore: 10) — 문법/맞춤법 오류

응답 JSON Schema:
{
  "overallScore": number,
  "sections": {
    "formatCompatibility": { "score": number, "maxScore": 20, "issues": string[], "suggestions": string[] },
    "keywordOptimization": { "score": number, "maxScore": 25, "matched": string[], "missing": string[] },
    "achievementQuality": { "score": number, "maxScore": 20, "weakBullets": string[], "improved": string[] },
    "structuralCompleteness": { "score": number, "maxScore": 15, "present": string[], "missing": string[] },
    "readability": { "score": number, "maxScore": 10, "issues": string[] },
    "grammar": { "score": number, "maxScore": 10, "errors": string[] }
  },
  "topStrengths": string[],
  "criticalImprovements": string[]
}

overallScore는 6개 섹션 점수의 합계입니다. 반드시 유효한 JSON만 출력하세요.`;

    try {
      const result = await callOpenAI(systemPrompt, input.resumeJson, MODEL_CONFIG.standard);

      // Zod 런타임 검증
      const parsed = JSON.parse(result);
      const validation = ATSAnalysisSchema.safeParse(parsed);
      if (!validation.success) {
        console.error('[calculateATSScore] 스키마 검증 실패:', validation.error.issues);
        throw new Error('ATS 분석 결과가 예상 스키마와 일치하지 않습니다.');
      }

      console.log('[calculateATSScore] 분석 및 검증 완료');
      return result;
    } catch (err) {
      console.error('[calculateATSScore] 실패:', err);
      throw new Error('ATS 점수 계산에 실패했습니다.');
    }
  },
});

/*
 * ─── Tool 3: generateResumeMarkdown ───
 * ParsedResume JSON → ATS 최적화 마크다운 이력서
 */
export const generateResumeMarkdown = tool({
  name: 'generate_resume_markdown',
  description:
    'ParsedResume JSON을 ATS 친화적인 마크다운 형식의 이력서로 변환합니다. 깔끔한 포맷, 정량적 성과 강조, 키워드 최적화를 적용합니다.',
  parameters: z.object({
    resumeJson: z.string().max(MAX_TEXT_INPUT).describe('ParsedResume JSON 문자열'),
  }),
  execute: async (input): Promise<string> => {
    const systemPrompt = `당신은 프로페셔널 이력서 작성 전문가입니다.
주어진 ParsedResume JSON을 ATS 친화적인 마크다운 이력서로 변환하세요.

작성 원칙:
- 헤더에 이름, 연락처 (이메일 | 전화 | LinkedIn | GitHub)
- 각 섹션은 ## 헤더 사용 (Education, Experience, Projects, Skills)
- Experience bullets는 "동사 + 정량적 성과" 패턴 (예: Reduced API latency by 40%)
- 3인칭 시점, 과거형 동사 사용
- 불필요한 대명사 제거
- 전체 1페이지 분량에 맞추기

마크다운만 출력하세요. JSON이 아닙니다. 코드블록도 쓰지 마세요.`;

    try {
      // responseFormat: null → json_object 포맷 없이 자유 텍스트(마크다운) 응답
      const markdown = await callOpenAI(
        systemPrompt,
        input.resumeJson,
        MODEL_CONFIG.fast,
        { responseFormat: null, temperature: 0.4 },
      );

      console.log('[generateResumeMarkdown] 생성 완료, 길이:', markdown.length);
      return markdown;
    } catch (err) {
      console.error('[generateResumeMarkdown] 실패:', err);
      throw new Error('마크다운 이력서 생성에 실패했습니다.');
    }
  },
});
