/**
 * 시작 에이전트 선택
 * ------------------------------------------------------------------
 * 원칙: **첫 턴에만 개입하고, 대화 도중에는 절대 강제 전환하지 않는다.**
 *
 * ## 왜 대화 중 강제 전환을 없앴는가
 *
 * 이전에는 "현재 에이전트가 처리할 수 없는 요청이면 옮긴다"는 규칙이 있었습니다.
 * 정규식이 의도를 잘못 잡으면 사용자가 **되돌아올 수 없는 곳으로 끌려갑니다.**
 *
 * 실제로 측정된 오탐:
 *   "제 프로젝트는 채용공고 크롤러입니다"  → search 로 판정
 *   "구직 사이트 만드는 프로젝트 했어요"    → search 로 판정
 *   "I built a job search platform"        → search 로 판정
 *
 * 취업 준비생이 가장 흔하게 만드는 포트폴리오가 채용 사이트입니다.
 * 이력서를 쓰던 학생이 자기 프로젝트를 설명하는 순간 Job Scout으로 튕겨나가고,
 * 그 설명이 그대로 웹 검색어가 되던 상황이었습니다.
 *
 * 이제 대화 중 전환은 **에이전트의 handoff**가 담당합니다. 모델은 대화 전체를
 * 보고 판단하므로 정규식보다 훨씬 정확하고, 잘못 가더라도 되돌아올 수 있습니다.
 * (definitions.ts에 되돌아오는 경로를 모두 열어 두었습니다.)
 *
 * ## 대화 중 에이전트를 바꾸면 안 되는 또 다른 이유
 *
 * `previousResponseId`로 이어지는 대화는 이전 기록이 OpenAI 서버에 남아 있습니다.
 * 다른 에이전트로 갈아타면 **이전 에이전트의 도구 호출 기록**을 새 에이전트가
 * 읽게 되고, 모델이 그 도구를 다시 호출하면 SDK가 실행을 중단시킵니다:
 *
 *   runner/modelOutputs.mjs — `Tool ${name} not found in agent ${agent.name}`
 *                             → ModelBehaviorError → 런 전체 abort
 *
 * SDK가 제공하는 해법인 `handoff({ inputFilter })`는 로컬 상태만 고칠 수 있어서
 * 서버에 저장된 기록에는 손대지 못합니다. 그래서 애초에 갈아타지 않는 것이 답입니다.
 */

import type { Agent } from '@openai/agents';
import { AGENT_NAMES } from './constants';
import { getAgentByName, triageAgent } from './index';
import { detectIntent, INTENT_AGENT } from './intent';
import type { AppContext } from './context';

// 의도 감지 자체는 `intent.ts`에 있습니다 — 그쪽은 `server-only` 에이전트 그래프를
// 끌어오지 않아 단위 테스트가 가능합니다.
export { detectIntent, type Intent } from './intent';

export interface RouteParams {
  message: string;
  /** 클라이언트가 보고한 현재 에이전트 */
  activeAgentName?: string;
  /** previousResponseId가 있는가 — 즉 대화가 이어지는 중인가 */
  hasSession: boolean;
  hasResumeText: boolean;
}

/**
 * 이번 턴을 시작할 에이전트를 고른다.
 */
export function routeIntent(params: RouteParams): Agent<AppContext> {
  /* ── 대화가 이어지는 중 ──
   * 무조건 현재 에이전트를 유지합니다. 전환은 handoff가 처리합니다. */
  if (params.hasSession) {
    return getAgentByName(params.activeAgentName);
  }

  /* ── 새 대화 (또는 사이드바로 수동 전환한 직후) ── */

  // 사용자가 사이드바에서 특정 에이전트를 직접 골랐다면 그 의사를 존중합니다.
  // (이 분기가 없어서, 수동 전환이 항상 Triage로 되돌아가는 버그가 있었습니다.)
  if (params.activeAgentName && params.activeAgentName !== AGENT_NAMES.TRIAGE) {
    return getAgentByName(params.activeAgentName);
  }

  // 의도가 분명하면 Triage를 건너뛰어 왕복 1회를 절약합니다.
  // 첫 턴에서는 오탐의 대가가 작습니다 — 해당 에이전트가 handoff로 넘기면 됩니다.
  const intent = detectIntent(params.message);
  if (intent) return getAgentByName(INTENT_AGENT[intent]);

  // 이력서 원문이 딸려 왔으면 분석부터 시작하는 편이 자연스럽습니다.
  if (params.hasResumeText) return getAgentByName(AGENT_NAMES.ANALYZER);

  return triageAgent;
}
