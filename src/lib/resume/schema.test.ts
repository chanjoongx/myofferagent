import { describe, it, expect } from 'vitest';
import {
  emptyResume,
  coerceResume,
  mergeResume,
  upsertListItem,
  removeListItem,
  completeness,
  isEmptyResume,
  threeWayMerge,
} from './schema';

describe('emptyResume', () => {
  it('부분 이력서도 항상 유효하다 — 대화 도중 어느 시점에 저장해도 깨지지 않아야 함', () => {
    const doc = emptyResume();
    expect(doc.version).toBe(1);
    expect(doc.basics.name).toBe('');
    expect(doc.education).toEqual([]);
    expect(isEmptyResume(doc)).toBe(true);
  });
});

describe('coerceResume', () => {
  it('null/undefined/쓰레기 입력에도 throw하지 않는다', () => {
    expect(coerceResume(null).version).toBe(1);
    expect(coerceResume(undefined).version).toBe(1);
    expect(coerceResume('nonsense').version).toBe(1);
    expect(coerceResume(42).version).toBe(1);
    expect(coerceResume({ basics: 'wrong type' }).version).toBe(1);
  });

  it('유효한 필드는 보존하고 누락 필드는 채운다', () => {
    const doc = coerceResume({ basics: { name: 'Chanjoong Kim' } });
    expect(doc.basics.name).toBe('Chanjoong Kim');
    expect(doc.basics.email).toBe('');
    expect(doc.skills.languages).toEqual([]);
  });

  it('문자열 배열에서 빈 항목을 제거한다', () => {
    const doc = coerceResume({ skills: { languages: ['TypeScript', '', '  ', 'Python'] } });
    expect(doc.skills.languages).toEqual(['TypeScript', 'Python']);
  });
});

describe('한도 초과는 절삭한다 — 절대 문서 전체를 날리지 않는다', () => {
  const filled = () =>
    upsertListItem(
      coerceResume({ basics: { name: 'Kim', email: 'k@x.com' }, targetRole: 'SWE' }),
      'experience',
      { company: 'Acme', title: 'Intern', bullets: ['first bullet'] },
    );

  it('불릿 13개(한도 12) — 나머지 문서는 그대로', () => {
    const doc = filled();
    const id = doc.experience[0].id;
    const after = upsertListItem(doc, 'experience', {
      id,
      bullets: Array.from({ length: 13 }, (_, i) => `bullet ${i}`),
    });

    expect(after.basics.name).toBe('Kim'); // 예전에는 여기서 전부 ''가 됐습니다
    expect(after.experience).toHaveLength(1);
    expect(after.experience[0].bullets).toHaveLength(12); // 절삭
  });

  it('60자 넘는 스킬 토큰 — 잘리되 문서는 유지', () => {
    const after = coerceResume({
      basics: { name: 'Kim', email: 'k@x.com' },
      skills: { languages: ['x'.repeat(80)] },
    });
    expect(after.basics.name).toBe('Kim');
    expect(after.skills.languages[0]).toHaveLength(60);
  });

  it('600자 넘는 불릿 — 잘리되 문서는 유지', () => {
    const doc = filled();
    const after = upsertListItem(doc, 'experience', {
      id: doc.experience[0].id,
      bullets: ['y'.repeat(900)],
    });
    expect(after.basics.name).toBe('Kim');
    expect(after.experience[0].bullets[0]).toHaveLength(600);
  });

  it('이름이 200자를 넘어도 다른 필드는 살아남는다', () => {
    const after = coerceResume({
      basics: { name: 'z'.repeat(400), email: 'k@x.com' },
      targetRole: 'SWE',
    });
    expect(after.basics.name).toHaveLength(200);
    expect(after.basics.email).toBe('k@x.com');
    expect(after.targetRole).toBe('SWE');
  });

  it('항목 21개(한도 20) — 20개로 절삭', () => {
    const after = coerceResume({
      basics: { name: 'Kim', email: 'k@x.com' },
      experience: Array.from({ length: 25 }, (_, i) => ({ company: `C${i}` })),
    });
    expect(after.basics.name).toBe('Kim');
    expect(after.experience).toHaveLength(20);
  });

  it('id가 문자열이 아니면 새 id를 발급한다 (중복 항목 생성 방지)', () => {
    const doc = filled();
    const after = upsertListItem(doc, 'experience', { id: 123, company: 'Other' });
    expect(after.experience.every((e) => typeof e.id === 'string' && e.id.length > 0)).toBe(true);
  });

  it('타입이 어긋난 필드는 해당 필드만 비운다', () => {
    const after = coerceResume({
      basics: { name: 'Kim', email: { nope: true }, phone: 42 },
      education: 'not an array',
    });
    expect(after.basics.name).toBe('Kim');
    expect(after.basics.email).toBe('');
    expect(after.basics.phone).toBe('');
    expect(after.education).toEqual([]);
  });
});

describe('mergeResume', () => {
  it('basics를 필드 단위로 병합한다 — 이메일만 바꿔도 이름이 남아야 함', () => {
    const base = coerceResume({ basics: { name: 'Kim', email: 'old@x.com', phone: '123' } });
    const merged = mergeResume(base, { basics: { email: 'new@x.com' } });

    expect(merged.basics.email).toBe('new@x.com');
    expect(merged.basics.name).toBe('Kim'); // 유실되지 않아야 함
    expect(merged.basics.phone).toBe('123');
  });

  it('명시적 undefined는 "지움"이 아니라 "안 건드림"으로 취급한다', () => {
    const base = coerceResume({ basics: { name: 'Kim', email: 'k@x.com' }, targetRole: 'SWE' });
    const merged = mergeResume(base, {
      targetRole: undefined,
      basics: { name: undefined },
    } as never);
    expect(merged.basics.name).toBe('Kim');
    expect(merged.targetRole).toBe('SWE');
  });

  it('패치에 없는 리스트 섹션은 그대로 둔다', () => {
    const base = upsertListItem(emptyResume(), 'experience', { company: 'Acme' });
    const merged = mergeResume(base, { targetRole: 'SWE' });
    expect(merged.experience).toHaveLength(1);
    expect(merged.targetRole).toBe('SWE');
  });
});

describe('upsertListItem', () => {
  it('id가 없으면 새 항목을 추가하고 id를 부여한다', () => {
    const doc = upsertListItem(emptyResume(), 'experience', { company: 'Acme', title: 'Intern' });
    expect(doc.experience).toHaveLength(1);
    expect(doc.experience[0].id).toBeTruthy();
    expect(doc.experience[0].company).toBe('Acme');
  });

  it('id가 일치하면 기존 항목을 수정하고 나머지 필드는 보존한다', () => {
    const first = upsertListItem(emptyResume(), 'experience', {
      company: 'Acme',
      title: 'Intern',
      bullets: ['Did a thing'],
    });
    const id = first.experience[0].id;

    const second = upsertListItem(first, 'experience', { id, title: 'Senior Intern' });

    expect(second.experience).toHaveLength(1);
    expect(second.experience[0].title).toBe('Senior Intern');
    expect(second.experience[0].company).toBe('Acme'); // 보존
    expect(second.experience[0].bullets).toEqual(['Did a thing']); // 보존
  });

  it('원본 문서를 변경하지 않는다', () => {
    const base = emptyResume();
    upsertListItem(base, 'projects', { name: 'X' });
    expect(base.projects).toHaveLength(0);
  });
});

describe('removeListItem', () => {
  it('id로 항목을 제거한다', () => {
    let doc = upsertListItem(emptyResume(), 'projects', { name: 'A' });
    doc = upsertListItem(doc, 'projects', { name: 'B' });
    const idA = doc.projects[0].id;

    const after = removeListItem(doc, 'projects', idA);
    expect(after.projects).toHaveLength(1);
    expect(after.projects[0].name).toBe('B');
  });
});

describe('threeWayMerge — 스트리밍 중 사용자 편집 보존', () => {
  const base = () =>
    upsertListItem(
      coerceResume({ basics: { name: 'Kim', email: 'old@x.com' }, targetRole: 'SWE' }),
      'experience',
      { id: 'e1', company: 'Acme', title: 'Intern', bullets: ['old bullet'] },
    );

  it('서버가 안 건드린 필드를 사용자가 고쳤으면 사용자 값이 이긴다', () => {
    const b = base();
    // 서버: 이메일만 갱신
    const theirs = coerceResume({ ...b, basics: { ...b.basics, email: 'server@x.com' } });
    // 사용자: 스트리밍 도중 이름을 고침
    const ours = coerceResume({ ...b, basics: { ...b.basics, name: 'Chanjoong Kim' } });

    const merged = threeWayMerge(b, ours, theirs);
    expect(merged.basics.name).toBe('Chanjoong Kim'); // 사용자 편집 보존
    expect(merged.basics.email).toBe('server@x.com'); // 서버 변경 반영
  });

  it('사용자가 안 건드린 필드는 서버 값을 따른다', () => {
    const b = base();
    const theirs = coerceResume({ ...b, targetRole: 'Backend Engineer' });
    const merged = threeWayMerge(b, b, theirs);
    expect(merged.targetRole).toBe('Backend Engineer');
  });

  it('같은 경력 항목을 양쪽이 다른 필드로 고치면 둘 다 살아남는다', () => {
    const b = base();
    const theirs = coerceResume({
      ...b,
      experience: [{ ...b.experience[0], bullets: ['server improved bullet'] }],
    });
    const ours = coerceResume({
      ...b,
      experience: [{ ...b.experience[0], company: 'Acme Corp' }],
    });

    const merged = threeWayMerge(b, ours, theirs);
    expect(merged.experience[0].company).toBe('Acme Corp'); // 사용자
    expect(merged.experience[0].bullets).toEqual(['server improved bullet']); // 서버
  });

  it('서버가 추가한 항목과 사용자가 추가한 항목이 모두 보존된다', () => {
    const b = base();
    const theirs = upsertListItem(b, 'projects', { id: 'p-server', name: 'From agent' });
    const ours = upsertListItem(b, 'projects', { id: 'p-user', name: 'From panel' });

    const merged = threeWayMerge(b, ours, theirs);
    const names = merged.projects.map((p) => p.name).sort();
    expect(names).toEqual(['From agent', 'From panel']);
  });

  it('아무도 안 고쳤으면 원본 그대로', () => {
    const b = base();
    expect(threeWayMerge(b, b, b)).toEqual(b);
  });
});

describe('completeness', () => {
  it('빈 이력서는 0%이고 내보낼 수 없다', () => {
    const c = completeness(emptyResume());
    expect(c.percent).toBe(0);
    expect(c.isExportable).toBe(false);
    expect(c.missing).toContain('resume.field.name');
  });

  it('이름+이메일+학력이 있으면 내보낼 수 있다', () => {
    const doc = upsertListItem(
      coerceResume({ basics: { name: 'Kim', email: 'k@x.com' } }),
      'education',
      { school: 'UCI' },
    );
    expect(completeness(doc).isExportable).toBe(true);
  });

  it('채울수록 점수가 오르고 missing이 줄어든다', () => {
    const sparse = coerceResume({ basics: { name: 'Kim' } });
    const fuller = upsertListItem(
      coerceResume({ basics: { name: 'Kim', email: 'k@x.com', phone: '1' }, targetRole: 'SWE' }),
      'experience',
      { company: 'Acme', bullets: ['Shipped X'] },
    );

    expect(completeness(fuller).percent).toBeGreaterThan(completeness(sparse).percent);
    expect(completeness(fuller).missing.length).toBeLessThan(completeness(sparse).missing.length);
  });
});
