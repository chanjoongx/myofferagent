/**
 * 에이전트 이름 상수 — 매직 스트링 방지.
 * 클라이언트/서버 양쪽에서 안전하게 import 가능.
 */
export const AGENT_NAMES = {
  TRIAGE: 'Triage Agent',
  BUILDER: 'Resume Builder',
  ANALYZER: 'Resume Analyzer',
  SCOUT: 'Job Scout',
  MATCH: 'Match Strategy',
  WRITER: 'Application Writer',
} as const;

export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];
