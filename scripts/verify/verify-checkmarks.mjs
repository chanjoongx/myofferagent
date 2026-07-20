/**
 * 사이드바 체크 표시 검증 (사용자가 신고한 버그)
 *
 * 증상: 에이전트가 **아무 일도 안 했는데** 다른 에이전트로 넘어가기만 하면
 *       이전 에이전트에 체크가 찍혔습니다.
 *
 * 고친 방식: 서버가 "실제로 쓰기 도구를 호출한" 에이전트만 completedAgents로
 *            보고합니다. get_resume 같은 읽기 전용 도구는 일한 걸로 안 칩니다.
 */
const BASE = process.argv[2] || 'http://localhost:8787';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(
    `  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? `\x1b[2m — ${detail}\x1b[0m` : ''}`,
  );
};

async function turn(state, message) {
  const res = await fetch(`${BASE}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [...state.history, { role: 'user', content: message }],
      sessionId: state.sessionId,
      language: 'ko',
      ...(state.resumeDoc ? { resumeDoc: state.resumeDoc } : {}),
      ...(state.activeAgent ? { activeAgentName: state.activeAgent } : {}),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const seen = { agents: [], tools: [], done: null, text: '' };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const block of parts) {
      const line = block.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line.slice(6)); } catch { continue; }
      if (ev.type === 'agent' && ev.name) seen.agents.push(ev.name);
      if (ev.type === 'tool_end' && ev.tool) seen.tools.push(ev.tool);
      if (ev.type === 'delta' && ev.text) seen.text += ev.text;
      if (ev.type === 'done') {
        seen.done = ev.payload ?? ev; // done은 payload 안에 담겨 옵니다
        if (seen.done.resumeDoc) state.resumeDoc = seen.done.resumeDoc;
      }
    }
  }
  state.history = [
    ...state.history,
    { role: 'user', content: message },
    { role: 'assistant', content: seen.text },
  ];
  if (seen.agents.length) state.activeAgent = seen.agents[seen.agents.length - 1];
  return seen;
}

const report = (r) => {
  const completed = r.done?.completedAgents ?? [];
  console.log(`  \x1b[2magents: ${r.agents.join(' → ') || '(없음)'}   tools: ${r.tools.join(',') || '(없음)'}\x1b[0m`);
  console.log(`  \x1b[2mcompletedAgents: ${JSON.stringify(completed)}\x1b[0m`);
  console.log(`  \x1b[2mdone keys: ${r.done ? Object.keys(r.done).join(',') : '(none)'}\x1b[0m`);
  console.log(`  \x1b[2mreply(${r.text.length}자): ${r.text.slice(0, 260).replace(/\n/g, ' ')}\x1b[0m`);
  return completed;
};

const state = { sessionId: `check_${Date.now()}`, history: [], resumeDoc: null, activeAgent: null };

console.log('\n\x1b[1m▶ 1) 인사만 — 아무 도구도 안 씀\x1b[0m');
{
  const r = await turn(state, '안녕하세요');
  const completed = report(r);
  check('done 이벤트가 completedAgents를 보냄', Array.isArray(completed));
  check('도구를 안 쓴 에이전트는 체크되지 않음', completed.length === 0, JSON.stringify(completed));
}

console.log('\n\x1b[1m▶ 2) 핸드오프 발생 — 넘겨받은 쪽은 아직 일 안 함\x1b[0m');
{
  const r = await turn(state, '이력서 만들고 싶어');
  const completed = report(r);
  check('핸드오프가 실제로 일어남', r.agents.length > 0, r.agents.join(' → '));
  check(
    '★ 넘어가기만 해서는 체크가 안 찍힘 (신고된 버그)',
    !completed.includes('Triage Agent') && !completed.includes('Triage'),
    JSON.stringify(completed),
  );
}

console.log('\n\x1b[1m▶ 3) 구체적 정보 제공 — 쓰기 도구가 도는 턴\x1b[0m');
{
  const r = await turn(
    state,
    '내 이름은 김찬중이고 이메일은 chanjoongx@gmail.com이야. 목표 직무는 Software Engineer Intern.',
  );
  const completed = report(r);
  const writeTools = r.tools.filter((t) => t !== 'get_resume');
  check('쓰기 도구가 실제로 호출됨', writeTools.length > 0, writeTools.join(',') || '(없음)');
  check('★ 실제로 일한 에이전트는 체크가 찍힘', completed.length > 0, JSON.stringify(completed));
  check(
    'Triage는 여전히 체크되지 않음',
    !completed.includes('Triage Agent') && !completed.includes('Triage'),
    JSON.stringify(completed),
  );
}

const failed = results.filter((r) => !r.pass);
console.log(
  `\n\x1b[1m${failed.length === 0 ? '\x1b[32m' : '\x1b[31m'}체크마크 검증: ${results.length - failed.length}/${results.length} 통과\x1b[0m`,
);
process.exit(failed.length === 0 ? 0 : 1);
