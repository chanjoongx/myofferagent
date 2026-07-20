import { describe, it, expect } from 'vitest';
import { hasFabricatedNumber } from './fabrication';

/**
 * 이 가드가 막으려는 것: AI가 이력서에 없는 수치를 지어내는 일.
 * 사용자가 면접에서 방어할 수 없는 숫자는 도움이 아니라 해입니다.
 */

describe('hasFabricatedNumber', () => {
  it('원문에 없던 숫자를 넣으면 날조로 판정', () => {
    expect(
      hasFabricatedNumber(
        'Worked on the backend API',
        '',
        'Reduced API latency by 40% by optimizing queries',
      ),
    ).toBe(true);
  });

  it('원문에 있던 숫자를 유지하면 통과', () => {
    expect(
      hasFabricatedNumber(
        'Reduced response time by 40%',
        '',
        'Cut API response time 40% by adding Redis caching',
      ),
    ).toBe(false);
  });

  it('맥락(회사·직무 설명)에 있던 숫자도 허용', () => {
    expect(
      hasFabricatedNumber(
        'Shipped the notification feature',
        'Acme Corp, backend intern, service has 12000 monthly active users',
        'Shipped a notification feature used by 12000 monthly active users',
      ),
    ).toBe(false);
  });

  it('숫자가 전혀 없는 재작성은 통과 (구조만 개선한 경우)', () => {
    expect(
      hasFabricatedNumber(
        'Worked on the backend API',
        '',
        'Built and maintained backend REST APIs for the core service',
      ),
    ).toBe(false);
  });

  it('쉼표·공백 표기 차이는 같은 숫자로 취급', () => {
    expect(hasFabricatedNumber('served 12,000 users', '', 'Served 12000 users')).toBe(false);
  });

  it('단위가 붙은 표기도 인식한다', () => {
    expect(hasFabricatedNumber('improved throughput 3x', '', 'Improved throughput by 3x')).toBe(
      false,
    );
    // 3x는 있었지만 50k는 없었음
    expect(hasFabricatedNumber('improved throughput 3x', '', 'Handled 50k requests')).toBe(true);
  });

  it('여러 숫자 중 하나만 날조여도 잡아낸다', () => {
    expect(
      hasFabricatedNumber(
        'Reduced latency by 40%',
        '',
        'Reduced latency by 40% across 15 microservices',
      ),
    ).toBe(true);
  });
});
