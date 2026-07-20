import { describe, it, expect, vi } from 'vitest';

/* upsert_experience의 current 3-상태 회귀 테스트 (2026-07-21 감사에서 추가)
 * 예전에는 current가 boolean이라 "제목만 고쳐줘" 편집에서 모델이 값을 빠뜨리면
 * default(false)로 떨어져 재직 중이던 경력의 Present가 조용히 사라졌습니다. */

vi.mock('server-only', () => ({}));
vi.mock('../openai-client', () => ({ callJson: vi.fn() }));

import { upsertExperience } from './resume-tools';
import { createContext, type AppContext } from '../context';
import { coerceResume } from '@/lib/resume/schema';
import type { RunContext } from '@openai/agents';

const rc = (ctx: AppContext) => ({ context: ctx }) as RunContext<AppContext>;

describe('upsert_experience current 3-상태', () => {
  it('current=null(변경 없음)은 기존 재직 상태를 보존한다', async () => {
    const ctx = createContext({
      resume: coerceResume({
        experience: [{ id: 'e1', company: 'Acme', title: 'Intern', current: true, endDate: '' }],
      }),
    });
    await upsertExperience.invoke(
      rc(ctx),
      JSON.stringify({ id: 'e1', title: 'Senior Intern', current: null }),
    );
    const e = ctx.resume.experience[0];
    expect(e.title).toBe('Senior Intern');
    expect(e.current).toBe(true); // 예전엔 default(false)로 뒤집혔음
  });

  it('current=false는 명시적으로 퇴사로 바꾼다', async () => {
    const ctx = createContext({
      resume: coerceResume({
        experience: [{ id: 'e1', company: 'Acme', title: 'Intern', current: true }],
      }),
    });
    await upsertExperience.invoke(
      rc(ctx),
      JSON.stringify({ id: 'e1', current: false, endDate: 'Aug 2025' }),
    );
    expect(ctx.resume.experience[0].current).toBe(false);
  });

  it('새 항목은 current=true를 반영한다', async () => {
    const ctx = createContext({ resume: coerceResume({}) });
    await upsertExperience.invoke(
      rc(ctx),
      JSON.stringify({ company: 'Beta', title: 'Engineer', current: true }),
    );
    expect(ctx.resume.experience[0].current).toBe(true);
  });
});
