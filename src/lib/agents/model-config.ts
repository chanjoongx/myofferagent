/**
 * 중앙 모델 설정
 * 모든 에이전트와 도구에서 사용하는 모델명을 한 곳에서 관리합니다.
 * 모델을 변경할 때 이 파일만 수정하면 됩니다.
 */
export const MODEL_CONFIG = {
  /** 빠른 응답이 필요한 작업 (파싱, 마크다운 생성, 트리아지 등) */
  fast: 'gpt-4o-mini',

  /** 정밀 분석이 필요한 작업 (ATS 분석, 매칭, 검색 등) */
  standard: 'gpt-4o',
} as const;

export type ModelKey = keyof typeof MODEL_CONFIG;
