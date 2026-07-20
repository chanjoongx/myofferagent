import { describe, it, expect } from 'vitest';
import { coerceResume, emptyResume, upsertListItem } from '../schema';
import { toMarkdown, toPlainText } from './markdown';
import { toPrintHtml, resumeFileName } from './print-html';
import {
  sectionOrder,
  formatDateRange,
  formatEducationDate,
  normalizeDate,
  displayUrl,
} from './shared';

const sample = coerceResume({
  basics: {
    name: 'Chanjoong Kim',
    email: 'chanjoongx@gmail.com',
    phone: '(949) 555-0142',
    location: 'Irvine, CA',
    linkedin: 'https://www.linkedin.com/in/chanjoongx/',
    github: 'github.com/chanjoongx',
  },
  education: [
    { school: 'UC Irvine', degree: 'B.S.', major: 'Computer Science', gpa: '3.8/4.0', endDate: 'Jun 2026' },
  ],
  experience: [
    {
      company: 'Acme Corp',
      title: 'SWE Intern',
      startDate: 'Jun 2025',
      current: true,
      bullets: ['Reduced p95 API latency by 40% by adding a Redis cache layer'],
    },
  ],
  skills: { languages: ['TypeScript', 'Python'] },
  targetRole: 'Software Engineer Intern',
});

describe('toMarkdown', () => {
  it('mailto 주소에 https://를 덧붙이지 않는다', () => {
    const md = toMarkdown(sample);
    expect(md).toContain('(mailto:chanjoongx@gmail.com)');
    expect(md).not.toContain('https://mailto:');
  });

  it('마침표·하이픈을 이스케이프하지 않는다 — B\\.S\\. 같은 결과가 나오면 안 됨', () => {
    const md = toMarkdown(sample);
    expect(md).toContain('B.S.');
    expect(md).toContain('3.8/4.0');
    expect(md).not.toMatch(/\\\./);
  });

  it('서식을 깨뜨릴 수 있는 문자는 이스케이프한다', () => {
    const doc = upsertListItem(emptyResume(), 'projects', {
      name: 'Test',
      bullets: ['Used *emphasis* and [brackets] and <tags>'],
    });
    const md = toMarkdown(doc);
    expect(md).toContain('\\*emphasis\\*');
    expect(md).toContain('\\[brackets\\]');
    expect(md).toContain('\\<tags\\>');
  });

  it('current=true이면 Present로 표기한다', () => {
    expect(toMarkdown(sample)).toContain('Jun 2025 – Present');
  });
});

describe('toPlainText', () => {
  it('이스케이프를 되돌려 ATS가 읽을 원문을 만든다', () => {
    const text = toPlainText(sample);
    expect(text).toContain('B.S.');
    expect(text).not.toContain('\\');
    expect(text).not.toContain('](');
    expect(text).not.toContain('##');
  });

  it('키워드 스캔에 필요한 내용을 유지한다', () => {
    const text = toPlainText(sample);
    expect(text).toContain('TypeScript');
    expect(text).toContain('Reduced p95 API latency by 40%');
  });
});

describe('toPrintHtml', () => {
  it('사용자 입력을 이스케이프한다 — iframe srcdoc에 주입되므로 XSS 방어가 필수', () => {
    const doc = upsertListItem(emptyResume(), 'projects', {
      name: '<script>alert(1)</script>',
      bullets: ['<img src=x onerror=alert(2)>'],
    });
    const html = toPrintHtml(doc);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('javascript: URL을 링크로 만들지 않는다', () => {
    const doc = upsertListItem(emptyResume(), 'projects', {
      name: 'Evil',
      url: 'javascript:alert(1)',
    });
    const html = toPrintHtml(doc);
    expect(html).not.toContain('href="javascript:');
  });

  it('ATS 친화 구조를 유지한다 — 레이아웃 표·머리말 없음', () => {
    const html = toPrintHtml(sample);
    expect(html).not.toContain('<table');
    expect(html).not.toContain('<header');
    expect(html).not.toContain('<footer');
    expect(html).toContain('<h2>Education</h2>');
    expect(html).toContain('<h2>Experience</h2>');
  });

  it('용지 옵션을 반영한다', () => {
    expect(toPrintHtml(sample, { paper: 'a4' })).toContain('size: a4');
  });

  it('여백은 @page가 아니라 body padding에 둔다 — Chrome이 URL·날짜 머리말을 끼워 넣지 않도록', () => {
    const html = toPrintHtml(sample, { marginIn: 0.75 });
    expect(html).toContain('margin: 0;');
    expect(html).toContain('padding: 0.75in');
  });

  it('한글이 있으면 lang을 ko로 설정한다', () => {
    expect(toPrintHtml(sample)).toContain('<html lang="en">');
    const ko = coerceResume({
      basics: { name: '김찬중', email: 'k@x.com' },
      experience: [{ company: 'Acme', bullets: ['백엔드 API 응답 시간을 40% 단축'] }],
    });
    expect(toPrintHtml(ko)).toContain('<html lang="ko">');
  });
});

describe('sectionOrder', () => {
  it('신입은 Education을 먼저 둔다', () => {
    expect(sectionOrder(sample).indexOf('education')).toBeLessThan(
      sectionOrder(sample).indexOf('experience'),
    );
  });

  /* 순서는 **졸업 여부**로 갈립니다 — 항목 개수가 아니라.
     예전에는 경력 2개면 무조건 Experience를 올려서, 카페 아르바이트 2개가
     학력을 밀어내고 네이버 인턴 1개짜리 이력서는 학력이 위에 남았습니다. */

  it('졸업 예정(미래)이면 경력이 많아도 Education이 먼저', () => {
    let doc = sample; // endDate: 'Jun 2026'
    doc = upsertListItem(doc, 'experience', { company: 'B', title: 'SWE' });
    doc = upsertListItem(doc, 'experience', { company: 'C', title: 'SWE' });
    const order = sectionOrder(doc, new Date('2025-07-01'));
    expect(order.indexOf('education')).toBeLessThan(order.indexOf('experience'));
  });

  it('이미 졸업했으면 Experience가 먼저', () => {
    const order = sectionOrder(sample, new Date('2030-01-01'));
    expect(order.indexOf('experience')).toBeLessThan(order.indexOf('education'));
  });

  it('졸업 연도를 알 수 없으면 경력 유무로 판단', () => {
    const noDate = coerceResume({
      basics: { name: 'Kim', email: 'k@x.com' },
      education: [{ school: 'UCI' }],
      experience: [{ company: 'Acme', title: 'SWE' }],
    });
    const order = sectionOrder(noDate);
    expect(order.indexOf('experience')).toBeLessThan(order.indexOf('education'));
  });

  it('빈 섹션은 제외한다', () => {
    expect(sectionOrder(emptyResume())).toEqual([]);
    expect(sectionOrder(sample)).not.toContain('projects');
  });
});

describe('helpers', () => {
  it('formatDateRange는 current를 Present로 바꾼다', () => {
    expect(formatDateRange('Jun 2025', '', true)).toBe('Jun 2025 – Present');
    expect(formatDateRange('Jun 2025', 'Aug 2025', false)).toBe('Jun 2025 – Aug 2025');
    expect(formatDateRange('', '', false)).toBe('');
  });

  it('displayUrl은 스킴과 www, 끝 슬래시를 제거한다', () => {
    expect(displayUrl('https://www.linkedin.com/in/foo/')).toBe('linkedin.com/in/foo');
  });

  it('파일명은 이름과 직무를 담고 공백을 밑줄로 바꾼다', () => {
    expect(resumeFileName(sample, 'pdf')).toBe(
      'Chanjoong_Kim_Resume_Software_Engineer_Intern.pdf',
    );
  });

  it('이름이 없어도 안전한 파일명을 만든다', () => {
    expect(resumeFileName(emptyResume(), 'docx')).toBe('Resume_Resume.docx');
  });
});

describe('normalizeDate — 출력 형식 통일', () => {
  it.each([
    ['2024-06', 'Jun 2024'],
    ['2024/06', 'Jun 2024'],
    ['2024-06-15', 'Jun 2024'],
    ['Jun 2025', 'Jun 2025'],
    ['June 2025', 'Jun 2025'],
    ['JUN. 2025', 'Jun 2025'],
    ['2025년 6월', 'Jun 2025'],
    ['2025', '2025'],
    ['Present', 'Present'],
    ['현재', 'Present'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });

  it('인식하지 못한 값은 원문을 보존한다 (사용자 입력을 망가뜨리지 않음)', () => {
    expect(normalizeDate('Summer 2025')).toBe('Summer 2025');
    expect(normalizeDate('2학기')).toBe('2학기');
  });

  it('섞인 형식도 한 형식으로 출력한다', () => {
    // 예전에는 "2024-06 – Aug 2024"가 그대로 인쇄됐습니다.
    expect(formatDateRange('2024-06', 'Aug 2024', false)).toBe('Jun 2024 – Aug 2024');
  });
});

describe('formatEducationDate — 졸업일 하나만 표기', () => {
  it('미래 졸업일에는 Expected를 붙인다', () => {
    expect(formatEducationDate('Sep 2022', 'Jun 2026', new Date('2025-07-01'))).toBe(
      'Expected Jun 2026',
    );
  });

  it('과거 졸업일은 그대로', () => {
    expect(formatEducationDate('Sep 2018', 'Jun 2022', new Date('2025-07-01'))).toBe('Jun 2022');
  });
});
