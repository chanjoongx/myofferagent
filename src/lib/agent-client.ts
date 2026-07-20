/**
 * `/api/agent` SSE 클라이언트
 * ------------------------------------------------------------------
 * `EventSource`는 GET만 지원하므로 `fetch` + 수동 SSE 파싱을 씁니다.
 *
 * SSE 프레임은 빈 줄(`\n\n`)로 구분되며, 각 프레임은 `data: <JSON>` 한 줄입니다.
 * 청크 경계가 프레임 중간을 자를 수 있으므로 버퍼에 모았다가 완성된 프레임만
 * 처리합니다.
 */

import type { AgentRequest, AgentResponse, AgentStreamEvent } from './types';
import type { ResumeDocument } from './resume/schema';

export interface StreamHandlers {
  /** 활성 에이전트 변경 (handoff 포함) */
  onAgent?: (name: string) => void;
  /** 도구 실행 시작/종료 — 진행 상황 표시용 */
  onTool?: (tool: string, phase: 'start' | 'end') => void;
  /** 응답 텍스트 조각 */
  onDelta?: (text: string) => void;
  /** 이력서 변경분 (오류로 끝나는 경우에도 도착할 수 있음) */
  onResume?: (doc: ResumeDocument) => void;
  /** 정상 종료 */
  onDone?: (payload: AgentResponse) => void;
  /** 오류 */
  onError?: (message: string) => void;
}

function dispatch(event: AgentStreamEvent, h: StreamHandlers): void {
  switch (event.type) {
    case 'agent':
      h.onAgent?.(event.name);
      break;
    case 'tool_start':
      h.onTool?.(event.tool, 'start');
      break;
    case 'tool_end':
      h.onTool?.(event.tool, 'end');
      break;
    case 'delta':
      h.onDelta?.(event.text);
      break;
    case 'resume':
      h.onResume?.(event.doc);
      break;
    case 'done':
      h.onDone?.(event.payload);
      break;
    case 'error':
      h.onError?.(event.message);
      break;
  }
}

export async function streamAgent(
  body: AgentRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.body) {
    handlers.onError?.(`API ${res.status}`);
    return;
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  // 서버가 죽거나 프록시가 응답을 자르면 'done'도 'error'도 오지 않은 채 스트림이
  // 끝납니다. 그대로 resolve하면 말풍선이 영원히 스트리밍 상태로 남습니다.
  let terminated = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;

      // 완성된 프레임만 처리하고, 마지막 미완성 조각은 버퍼에 남깁니다.
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (line) {
          try {
            const parsed = JSON.parse(line.slice(5).trim()) as AgentStreamEvent;
            if (parsed.type === 'done' || parsed.type === 'error') terminated = true;
            dispatch(parsed, handlers);
          } catch {
            // 손상된 프레임은 건너뜁니다 — 스트림 전체를 죽이지 않습니다.
          }
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!terminated) {
    handlers.onError?.('STREAM_TRUNCATED');
  }
}
