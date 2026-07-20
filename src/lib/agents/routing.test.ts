import { describe, it, expect } from 'vitest';
import { detectIntent } from './intent';

/**
 * 이 테스트의 절반은 **오탐 방지**입니다.
 * 기존 route.ts의 라우팅 정규식은 아래처럼 생겨서
 *
 *   /(\d{1,2})\s*(번|번째|…)|(\d{1,2})\s*(분석|선택|지원|매칭|할게|줘|요|해|…)|…/
 *
 * "3개만 알려줘" 같은 평범한 문장에도 걸려 엉뚱한 에이전트로 보내졌습니다.
 */

describe('detectIntent — 채용공고 검색', () => {
  it.each([
    '채용공고 검색해줘',
    '머신러닝 인턴 자리 찾아줘',
    '어바인에서 구직 중이야',
    'find me a software engineering internship',
    'search for jobs in the bay area',
    "who's hiring right now",
  ])('감지: %s', (msg) => {
    expect(detectIntent(msg)).toBe('search');
  });
});

describe('detectIntent — 이력서 분석', () => {
  it.each([
    '이력서 분석해줘',
    '내 이력서 점수 좀 봐줘',
    'ATS 점수 알려줘',
    'can you review my resume',
    'analyze my resume please',
  ])('감지: %s', (msg) => {
    expect(detectIntent(msg)).toBe('analyze');
  });
});

describe('detectIntent — 이력서 작성', () => {
  it.each([
    '이력서 만들어줘',
    '이력서가 없어',
    '이력서 처음부터 작성하고 싶어',
    'help me build a resume',
    'create a resume from scratch',
  ])('감지: %s', (msg) => {
    expect(detectIntent(msg)).toBe('build');
  });
});

describe('detectIntent — 커버레터', () => {
  it.each(['커버레터 써줘', '자기소개서 작성', 'write a cover letter'])(
    '감지: %s',
    (msg) => {
      expect(detectIntent(msg)).toBe('cover_letter');
    },
  );
});

describe('detectIntent — 오탐 방지 (기존 정규식이 잘못 잡던 문장들)', () => {
  it.each([
    '3개만 알려줘',
    '2번 항목 고쳐줘',
    '세 번째 불릿 다시 써줘',
    '네',
    '좋아요',
    '고마워',
    'thanks',
    'yes please',
    '그거 말고 다른 걸로',
    'GPA는 3.8이야',
    '2024년부터 2025년까지 일했어',
  ])('의도 없음으로 판정: %s', (msg) => {
    expect(detectIntent(msg)).toBeNull();
  });
});

describe('detectIntent — 경계', () => {
  it('빈 문자열과 공백은 null', () => {
    expect(detectIntent('')).toBeNull();
    expect(detectIntent('   ')).toBeNull();
  });

  it('커버레터가 검색보다 우선한다', () => {
    expect(detectIntent('이 채용공고에 맞춰 커버레터 써줘')).toBe('cover_letter');
  });

  it('이력서 언급만으로 작성 의도로 오인하지 않는다', () => {
    expect(detectIntent('이력서에 뭐라고 적을지 고민이야')).toBeNull();
  });
});
