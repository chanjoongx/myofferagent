import { describe, it, expect, vi } from 'vitest';

/* upsert_experience의 current 3-상태 회귀 테스트 (2026-07-21 감사에서 추가)
 * 예전에는 current가 boolean이라 "제목만 고쳐줘" 편집에서 모델이 값을 빠뜨리면
 * default(false)로 떨어져 재직 중이던 경력의 Present가 조용히 사라졌습니다. */

vi.mock('server-only', () => ({}));
vi.mock('../openai-client', () => ({ callJson: vi.fn() }));

import { upsertExperience, getResume } from './resume-tools';
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

/* 배열 센티널 처리 (2026-07-21 심층 검토에서 추가)
 * 단독 [CLEAR]만 처리하던 시절, 혼합 배열의 센티널이 이력서 본문으로 저장됐습니다. */
describe('배열 CLEAR 센티널', () => {
  it('배열에 섞인 CLEAR는 콘텐츠로 저장되지 않는다', async () => {
    const ctx = createContext({
      resume: coerceResume({
        experience: [{ id: 'e1', company: 'Acme', title: 'Intern', bullets: ['old'] }],
      }),
    });
    await upsertExperience.invoke(
      rc(ctx),
      JSON.stringify({ id: 'e1', bullets: ['__CLEAR__', 'real bullet'], current: null }),
    );
    expect(ctx.resume.experience[0].bullets).toEqual(['real bullet']);
  });

  it('CLEAR만 담긴 배열은 비우기로 해석된다', async () => {
    const ctx = createContext({
      resume: coerceResume({
        experience: [{ id: 'e1', company: 'Acme', title: 'Intern', bullets: ['old'] }],
      }),
    });
    await upsertExperience.invoke(
      rc(ctx),
      JSON.stringify({ id: 'e1', bullets: ['__CLEAR__'], current: null }),
    );
    expect(ctx.resume.experience[0].bullets).toEqual([]);
  });
});

/* 섹션 상한(20개) 정직 보고 (2026-07-21 심층 검토에서 추가)
 * 상한에 걸려 추가가 무시됐는데 "저장했습니다"를 돌려주던 거짓 성공을 고정합니다. */
describe('섹션 상한 정직 보고', () => {
  it('가득 찬 섹션에 새 항목을 추가하면 실패를 보고하고 문서를 바꾸지 않는다', async () => {
    const ctx = createContext({
      resume: coerceResume({
        experience: Array.from({ length: 20 }, (_, i) => ({
          id: `e${i}`,
          company: `C${i}`,
          title: 'T',
        })),
      }),
    });
    const out = await upsertExperience.invoke(
      rc(ctx),
      JSON.stringify({ company: 'Overflow Inc', title: 'X' }),
    );
    expect(ctx.resume.experience).toHaveLength(20);
    expect(ctx.resume.experience.some((e) => e.company === 'Overflow Inc')).toBe(false);
    expect(String(out)).toContain('가득');
  });
});

/* get_resume 뷰 (2026-07-21 심층 검토에서 추가)
 * summary가 개수만 담는 탓에, 커버레터·매칭이 실제 불릿을 읽을 방법이 없었습니다. */
describe('get_resume view', () => {
  it('full 뷰는 실제 불릿 텍스트를 담고, summary는 담지 않는다', async () => {
    const ctx = createContext({
      resume: coerceResume({
        experience: [
          { company: 'Acme', title: 'Intern', bullets: ['Reduced latency 40% with Redis'] },
        ],
      }),
    });
    const summary = String(await getResume.invoke(rc(ctx), JSON.stringify({})));
    expect(summary).not.toContain('Reduced latency');

    const full = String(await getResume.invoke(rc(ctx), JSON.stringify({ view: 'full' })));
    expect(full).toContain('Reduced latency 40% with Redis');
  });
});
