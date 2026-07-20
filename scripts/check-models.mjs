#!/usr/bin/env node
/**
 * 설정된 모델이 실제로 사용 가능한지 확인한다.
 *
 *   npm run check:models
 *
 * `MODEL_CONFIG`의 기본값은 `/v1/models` 목록에 존재함을 확인했지만,
 * 개발 당시 API 키에 크레딧이 없어 **실제 추론 호출은 검증하지 못했습니다.**
 * 이 스크립트는 두 가지를 모두 확인합니다:
 *   1. 모델이 목록에 있는가
 *   2. 실제로 호출이 되는가 (그리고 어떤 파라미터를 거부하는가)
 */

import { readFileSync } from 'node:fs';

function loadEnv() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const file of ['.env.local', '.env']) {
    try {
      const match = readFileSync(file, 'utf8').match(/^OPENAI_API_KEY=(.+)$/m);
      if (match) return match[1].trim();
    } catch {
      /* 파일 없음 */
    }
  }
  return null;
}

const KEY = loadEnv();
if (!KEY) {
  console.error('OPENAI_API_KEY를 찾을 수 없습니다 (.env.local 또는 환경변수).');
  process.exit(1);
}

const FAST = process.env.OPENAI_MODEL_FAST || 'gpt-5.4-mini';
const STANDARD = process.env.OPENAI_MODEL_STANDARD || 'gpt-5.5';

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` };

async function listModels() {
  const res = await fetch('https://api.openai.com/v1/models', { headers });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return new Set(json.data.map((m) => m.id));
}

async function probe(model) {
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_completion_tokens: 2000,
    }),
  });
  const json = await res.json();
  if (json.error) return { ok: false, detail: `${res.status} ${json.error.code ?? ''} — ${json.error.message}` };
  return {
    ok: true,
    detail: `${Date.now() - started}ms, reply="${(json.choices[0].message.content || '').trim().slice(0, 20)}"`,
  };
}

const available = await listModels();
console.log(`사용 가능한 모델 ${available.size}개\n`);

let failed = false;
for (const [label, model] of [
  ['fast    ', FAST],
  ['standard', STANDARD],
]) {
  const listed = available.has(model);
  process.stdout.write(`${label}  ${model.padEnd(18)} 목록: ${listed ? 'O' : 'X'}  `);
  if (!listed) {
    console.log('→ 이 계정에서 사용할 수 없는 모델입니다');
    failed = true;
    continue;
  }
  const result = await probe(model);
  console.log(`호출: ${result.ok ? 'O' : 'X'}  ${result.detail}`);
  if (!result.ok) failed = true;
}

if (failed) {
  console.log('\n대안은 src/lib/agents/model-config.ts의 KNOWN_MODELS를 참고하세요.');
  console.log('OPENAI_MODEL_FAST / OPENAI_MODEL_STANDARD 환경변수로 교체할 수 있습니다.');
  process.exit(1);
}
console.log('\n모델 설정 정상.');
