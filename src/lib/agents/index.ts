export {
  triageAgent,
  resumeBuilderAgent,
  resumeAnalyzerAgent,
  jobScoutAgent,
  matchStrategyAgent,
  applicationWriterAgent,
} from './definitions';

export { triageAgent as default } from './definitions';

// ── 에이전트 이름 상수 re-export (클라이언트에서도 import 가능한 별도 파일) ──
export { AGENT_NAMES, type AgentName } from './constants';
import { AGENT_NAMES } from './constants';

// ── 에이전트 이름 → 인스턴스 조회 맵 ──
import {
  triageAgent,
  resumeBuilderAgent,
  resumeAnalyzerAgent,
  jobScoutAgent,
  matchStrategyAgent,
  applicationWriterAgent,
} from './definitions';

const agentMap: Record<string, typeof triageAgent> = {
  [AGENT_NAMES.TRIAGE]: triageAgent,
  [AGENT_NAMES.BUILDER]: resumeBuilderAgent,
  [AGENT_NAMES.ANALYZER]: resumeAnalyzerAgent,
  [AGENT_NAMES.SCOUT]: jobScoutAgent,
  [AGENT_NAMES.MATCH]: matchStrategyAgent,
  [AGENT_NAMES.WRITER]: applicationWriterAgent,
};

/**
 * 에이전트 이름으로 인스턴스를 반환한다.
 * 없으면 triageAgent(기본값)를 반환.
 */
export function getAgentByName(name: string | undefined) {
  if (!name) return triageAgent;
  return agentMap[name] ?? triageAgent;
}
