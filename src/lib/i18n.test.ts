import { describe, it, expect } from 'vitest';
import { dict, t } from './i18n';

/* ko/en 패리티 회귀 테스트 (2026-07-21 감사에서 추가)
 * t()는 en에 키가 없으면 ko로 조용히 폴백합니다. 편리하지만, 번역 누락이
 * "영어 화면에 한국어 문장이 섞여 나오는" 형태로 소리 없이 새는 경로이기도
 * 합니다. 키 집합을 컴파일 타임이 아니라 테스트로 고정합니다. */

describe('i18n 사전', () => {
  it('ko와 en의 키 집합이 완전히 일치한다', () => {
    const ko = Object.keys(dict.ko).sort();
    const en = Object.keys(dict.en).sort();
    expect(en).toEqual(ko);
  });

  it('플레이스홀더({name} 등)가 양쪽 언어에서 동일하다', () => {
    const params = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(dict.ko)) {
      expect(params(dict.en[key] ?? ''), `key: ${key}`).toEqual(params(dict.ko[key]));
    }
  });

  it('파라미터 치환이 동작한다', () => {
    expect(t('ko', 'chat.agentSwitch', { agent: 'Job Scout' })).toContain('Job Scout');
    expect(t('en', 'sidebar.step', { current: '2', total: '6' })).toBe('2 / 6');
  });

  it('없는 키는 키 문자열 자체를 반환한다 (빈 화면 방지)', () => {
    expect(t('en', 'no.such.key')).toBe('no.such.key');
  });
});
