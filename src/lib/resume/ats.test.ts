import { describe, it, expect } from 'vitest';
import { coerceResume, emptyResume, upsertListItem } from './schema';
import {
  scoreRules,
  combineScores,
  gradeOf,
  isStrongVerb,
  hasQuantity,
  hasFirstPerson,
} from './ats';

/** 불릿만 다른 이력서를 만드는 헬퍼 */
function withBullets(bullets: string[]) {
  return upsertListItem(
    coerceResume({ basics: { name: 'Kim', email: 'k@x.com' } }),
    'experience',
    { company: 'Acme', title: 'Intern', bullets },
  );
}

/* ══════════════════════════════════════════════════════════════
   절대 기준 테스트
   ──────────────────────────────────────────────────────────────
   기존 테스트는 "정량적 불릿이 모호한 불릿보다 높다" 같은 **상대 비교**만
   했습니다. 그래서 채점기가 좋은 이력서에 9.8/20을 주고 최고 불릿들을
   "약함"으로 표시하는 동안에도 전부 통과했습니다.
   여기서는 실제 값을 못박습니다.
   ══════════════════════════════════════════════════════════════ */

describe('isStrongVerb — 허용 목록이 아니라 형태론', () => {
  it.each([
    'built', 'wrote', 'led', 'won', 'owned', 'mentored', 'containerized',
    'benchmarked', 'shipped', 'migrated', 'refactored', 'automated',
    'parallelized', 'hardened', 'founded', 'halved', 'doubled', 'profiled',
  ])('강한 동사로 인정: %s', (v) => {
    expect(isStrongVerb(v)).toBe(true);
  });

  it.each(['worked', 'helped', 'assisted', 'used', 'participated', 'supported', 'maintained'])(
    '약한 동사로 판정: %s',
    (v) => {
      expect(isStrongVerb(v)).toBe(false);
    },
  );
});

describe('hasQuantity — 단위가 붙은 수치를 놓치지 않는다', () => {
  it.each([
    'Reduced p99 latency from 240ms to 90ms',
    'Processed 500GB of logs nightly',
    'Sustained 4k msg/s throughput',
    'Led a team of 5 engineers',
    'Owned migration of 8 REST endpoints',
    'Improved throughput 3x',
    'Cut costs by $50k',
    'Served 12,000 monthly users',
    'Won 1st place at the hackathon',
    'Reduced latency by 40%',
  ])('수치로 인정: %s', (b) => {
    expect(hasQuantity(b)).toBe(true);
  });

  it.each([
    'Completed the capstone project in 2025',
    'Built a REST API with Spring Boot 3 and Java 17',
    'Migrated the service to Python 3.11',
    'Worked on the backend API',
  ])('수치 아님 (연도·버전·무수치): %s', (b) => {
    expect(hasQuantity(b)).toBe(false);
  });
});

describe('hasFirstPerson — I/O는 1인칭이 아니다', () => {
  it('I/O를 오탐하지 않는다', () => {
    expect(hasFirstPerson('Improved I/O throughput by 40%')).toBe(false);
  });

  it.each(['Optimized checkout flow for US users', 'Localized pricing for the U.S. market'])(
    'US(미국)를 대명사 us로 오탐하지 않음: %s',
    (b) => {
      expect(hasFirstPerson(b)).toBe(false);
    },
  );

  it.each(['CI pipelines', 'BI dashboards', 'AI models', 'iOS app', 'MySQL tuning'])(
    '기술 약어를 오탐하지 않음: %s',
    (b) => {
      expect(hasFirstPerson(b)).toBe(false);
    },
  );

  it.each(['I built a compiler', 'my own project', 'we shipped it', 'our team', 'helped us grow'])(
    '실제 1인칭은 잡아냄: %s',
    (b) => {
      expect(hasFirstPerson(b)).toBe(true);
    },
  );
});

describe('강한 이력서는 실제로 높은 점수를 받아야 한다', () => {
  const strong = coerceResume({
    basics: { name: 'Jiwoo Park', email: 'j@x.com', phone: '1', github: 'github.com/j' },
    education: [
      {
        school: 'Seoul National University',
        degree: 'B.S.',
        major: 'Computer Science',
        gpa: '3.9/4.3',
        endDate: 'Feb 2026',
        // 수강 과목 — 성과 불릿이 아니므로 감점 대상이면 안 됨
        highlights: ['Relevant Coursework: Data Structures, Algorithms, Databases'],
      },
    ],
    experience: [
      {
        company: 'Naver',
        title: 'Backend Intern',
        bullets: [
          'Owned migration of 8 REST endpoints, dropping p99 latency from 240ms to 90ms',
          'Wrote a batch pipeline processing 1.2M records nightly',
          'Mentored 2 incoming interns on the service codebase',
          'Containerized the service with Docker, cutting deploy time in half',
        ],
      },
    ],
    projects: [
      {
        name: 'Kafka pipeline',
        bullets: [
          'Benchmarked Kafka at 4k msg/s sustained throughput',
          'Improved I/O throughput by 40% via async batching',
        ],
      },
    ],
    skills: { languages: ['Java', 'Python'], frameworks: ['Spring Boot'] },
    targetRole: 'Backend Engineer',
  });

  it('achievementQuality가 16점 이상', () => {
    expect(scoreRules(strong).achievementQuality.score).toBeGreaterThanOrEqual(16);
  });

  it('좋은 불릿을 "약한 불릿"으로 지목하지 않는다', () => {
    expect(scoreRules(strong).achievementQuality.weakBullets).toEqual([]);
  });

  it('readability가 9점 이상 (수강 과목이 짧다고 감점되면 안 됨)', () => {
    expect(scoreRules(strong).readability.score).toBeGreaterThanOrEqual(9);
  });
});

describe('한국 이력서 관행 검출', () => {
  it('생년월일·성별이 남아 있으면 문제로 잡는다', () => {
    const r = scoreRules(
      coerceResume({
        basics: { name: 'Kim', email: 'k@x.com', summary: 'Date of Birth: 1999-03-02, Gender: Male' },
      }),
    );
    expect(r.formatCompatibility.issues.join(' ')).toContain('생년월일');
  });

  it('만점 없는 GPA를 잡아낸다', () => {
    const r = scoreRules(
      coerceResume({
        basics: { name: 'Kim', email: 'k@x.com' },
        education: [{ school: 'SNU', gpa: '4.1' }],
      }),
    );
    expect(r.formatCompatibility.issues.join(' ')).toContain('만점');
  });

  it('만점을 함께 적으면 문제로 잡지 않는다', () => {
    const r = scoreRules(
      coerceResume({
        basics: { name: 'Kim', email: 'k@x.com' },
        education: [{ school: 'SNU', gpa: '4.1/4.5' }],
      }),
    );
    expect(r.formatCompatibility.issues.join(' ')).not.toContain('만점');
  });

  it('본문이 한국어면 영어로 쓰라고 안내한다', () => {
    const r = scoreRules(
      coerceResume({
        basics: { name: 'Kim', email: 'k@x.com' },
        experience: [{ company: 'Naver', bullets: ['백엔드 API 응답 시간을 40% 단축했습니다'] }],
      }),
    );
    expect(r.formatCompatibility.issues.join(' ')).toContain('영어');
  });
});

describe('scoreRules — 결정론', () => {
  it('같은 입력은 항상 같은 점수를 낸다', () => {
    const doc = withBullets(['Reduced latency by 40%']);
    const a = scoreRules(doc);
    const b = scoreRules(doc);
    expect(a).toEqual(b);
  });
});

describe('formatCompatibility', () => {
  it('연락처가 없으면 문제로 잡는다', () => {
    const r = scoreRules(emptyResume());
    expect(r.formatCompatibility.issues.join(' ')).toContain('이름');
    expect(r.formatCompatibility.issues.join(' ')).toContain('이메일');
  });

  it('잘못된 이메일 형식을 잡아낸다', () => {
    const r = scoreRules(coerceResume({ basics: { name: 'Kim', email: 'not-an-email' } }));
    expect(r.formatCompatibility.issues.join(' ')).toContain('이메일 형식');
  });

  it('올바른 연락처는 점수를 얻는다', () => {
    const bad = scoreRules(coerceResume({ basics: { name: 'Kim', email: 'bad' } }));
    const good = scoreRules(
      coerceResume({
        basics: { name: 'Kim', email: 'k@x.com', phone: '1', github: 'github.com/k' },
      }),
    );
    expect(good.formatCompatibility.score).toBeGreaterThan(bad.formatCompatibility.score);
  });
});

describe('achievementQuality — 정량적 성과 검출', () => {
  it('숫자가 있는 불릿에 더 높은 점수를 준다', () => {
    const vague = scoreRules(withBullets(['Worked on the backend API for the team project']));
    const quantified = scoreRules(
      withBullets(['Reduced p95 API latency by 40% by adding a Redis cache layer']),
    );
    expect(quantified.achievementQuality.score).toBeGreaterThan(vague.achievementQuality.score);
  });

  it('다양한 정량 표현을 인식한다', () => {
    for (const bullet of [
      'Reduced latency by 40%',
      'Served 12000 monthly active users',
      'Cut costs by $50k annually',
      'Improved throughput 3x over the previous design',
    ]) {
      const r = scoreRules(withBullets([bullet]));
      expect(r.achievementQuality.score).toBeGreaterThan(8);
    }
  });

  it('강한 동사로 시작하면 가산점을 준다', () => {
    const weak = scoreRules(withBullets(['Responsible for the payment system maintenance work']));
    const strong = scoreRules(withBullets(['Rebuilt the payment system maintenance workflow']));
    expect(strong.achievementQuality.score).toBeGreaterThan(weak.achievementQuality.score);
  });

  it('약한 불릿을 지목해 돌려준다', () => {
    const r = scoreRules(withBullets(['Worked on the backend API for the team project']));
    expect(r.achievementQuality.weakBullets.length).toBeGreaterThan(0);
  });
});

describe('readability', () => {
  it('1인칭 대명사를 잡아낸다', () => {
    const r = scoreRules(withBullets(['I built my own compiler for the class project work']));
    expect(r.readability.issues.join(' ')).toContain('1인칭');
  });

  it('지나치게 긴 불릿을 잡아낸다', () => {
    const r = scoreRules(withBullets(['Built '.repeat(60)]));
    expect(r.readability.issues.join(' ')).toContain('깁니다');
  });
});

describe('structuralCompleteness', () => {
  it('누락 섹션을 나열한다', () => {
    const r = scoreRules(emptyResume());
    expect(r.structuralCompleteness.missing).toContain('Education');
    expect(r.structuralCompleteness.score).toBe(0);
  });

  it('섹션을 채우면 점수가 오른다', () => {
    const r = scoreRules(withBullets(['Shipped a thing that reduced load by 20%']));
    expect(r.structuralCompleteness.present).toContain('Contact');
    expect(r.structuralCompleteness.score).toBeGreaterThan(0);
  });
});

describe('combineScores', () => {
  const rules = scoreRules(withBullets(['Reduced latency by 40% across the fleet']));
  const llm = {
    keywordOptimization: { score: 20, matched: ['TypeScript'], missing: ['Kubernetes'] },
    grammar: { score: 9, errors: [] },
  };

  it('overallScore는 6개 섹션의 실제 합계다', () => {
    const a = combineScores(rules, llm, emptyResume());
    const sum =
      a.sections.formatCompatibility.score +
      a.sections.keywordOptimization.score +
      a.sections.achievementQuality.score +
      a.sections.structuralCompleteness.score +
      a.sections.readability.score +
      a.sections.grammar.score;
    expect(a.overallScore).toBeCloseTo(sum, 1);
  });

  it('총점은 0..100 범위를 벗어나지 않는다', () => {
    const a = combineScores(rules, llm, emptyResume());
    expect(a.overallScore).toBeGreaterThanOrEqual(0);
    expect(a.overallScore).toBeLessThanOrEqual(100);
  });

  it('LLM이 범위를 벗어난 점수를 줘도 잘라낸다', () => {
    const a = combineScores(
      rules,
      {
        keywordOptimization: { score: 999, matched: [], missing: [] },
        grammar: { score: -5, errors: [] },
      },
      emptyResume(),
    );
    expect(a.sections.keywordOptimization.score).toBe(25);
    expect(a.sections.grammar.score).toBe(0);
  });

  it('손실이 큰 섹션을 개선 과제로 우선 제시한다', () => {
    const a = combineScores(
      scoreRules(emptyResume()),
      { keywordOptimization: { score: 2, matched: [], missing: ['React'] }, grammar: { score: 3, errors: [] } },
      emptyResume(),
    );
    expect(a.criticalImprovements.length).toBeGreaterThan(0);
    expect(a.criticalImprovements.length).toBeLessThanOrEqual(3);
  });
});

describe('gradeOf', () => {
  it('점수를 등급으로 변환한다', () => {
    expect(gradeOf(95)).toBe('excellent');
    expect(gradeOf(75)).toBe('good');
    expect(gradeOf(55)).toBe('fair');
    expect(gradeOf(30)).toBe('poor');
  });
});
