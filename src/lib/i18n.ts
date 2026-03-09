export type Locale = 'ko' | 'en';

const dict: Record<Locale, Record<string, string>> = {
  ko: {
    // ── Nav ──
    'nav.home': 'My Offer Agent',

    // ── Landing ──
    'landing.badge': 'AI Career Agent',
    'landing.title1': 'My Offer',
    'landing.title2': 'Agent',
    'landing.subtitle':
      'AI가 이력서 작성부터 맞춤 채용공고 매칭까지,\n취업 준비의 모든 과정을 함께합니다',
    'landing.cta': '시작하기',
    'landing.flowTitle': 'Agent Workflow',

    // ── Agent Steps ──
    'step.triage': 'Triage',
    'step.triage.desc': '이력서 유무를 파악하고 최적의 경로로 안내합니다',
    'step.builder': 'Builder',
    'step.builder.desc': '대화를 통해 ATS 친화적인 이력서를 함께 작성합니다',
    'step.analyzer': 'Analyzer',
    'step.analyzer.desc': '이력서를 100점 만점 기준으로 정밀 분석합니다',
    'step.scout': 'Scout',
    'step.scout.desc': '실시간 웹 검색으로 맞춤 채용공고를 탐색합니다',
    'step.match': 'Match',
    'step.match.desc': '이력서와 채용공고 간 적합도를 분석합니다',
    'step.writer': 'Writer',
    'step.writer.desc': '맞춤 커버레터와 최적화된 이력서를 생성합니다',

    // ── Chat UI ──
    'chat.placeholder': '메시지를 입력하세요...',
    'chat.welcome':
      '안녕하세요! **My Offer Agent**입니다.\n이력서 작성부터 맞춤 채용공고 매칭까지 도와드릴게요. 무엇부터 시작할까요?',
    'chat.error': '응답을 받지 못했습니다. 다시 시도해 주세요.',
    'chat.agentSwitch': '{agent}로 전환되었습니다',
    'chat.pdfLabel': 'PDF 이력서',
    'chat.analyzeAuto': '이력서를 분석해주세요.',
    'chat.downloadResume': '이력서 다운로드 (.md)',
    'chat.downloadResumePdf': 'PDF로 저장',
    'chat.fileSizeError': '파일 크기는 10MB 이하여야 합니다.',
    'chat.pdfError': 'PDF 파일을 읽을 수 없습니다.',
    'chat.pdfTooltip': 'PDF 첨부',
    'chat.send': '전송',
    'chat.removeFile': '첨부 파일 제거',
    'chat.olderHidden': '이전 메시지 {count}개가 숨겨져 있습니다',
    'chat.messageList': '대화 메시지 목록',
    'chat.loading': '응답 생성 중...',
    'chat.retry': '다시 시도',

    // ── Sidebar ──
    'sidebar.title': 'Agents',
    'sidebar.done': '완료',
    'sidebar.step': '{current} / {total}',
    'sidebar.newChat': '새 대화',

    // ── JobCard ──
    'job.analyze': '분석하기',
    'job.viewPosting': '공고 보기',
    'job.remote': 'Remote',
    'job.onsite': 'Onsite',
    'job.hybrid': 'Hybrid',

    // ── ATS Score Card ──
    'ats.title': 'ATS 호환성 점수',
    'ats.formatCompatibility': '포맷 호환성',
    'ats.keywordOptimization': '키워드 최적화',
    'ats.achievementQuality': '성과 품질',
    'ats.structuralCompleteness': '구조적 완성도',
    'ats.readability': '가독성',
    'ats.grammar': '문법 및 맞춤법',
    'ats.strengths': '강점',
    'ats.improvements': '개선사항',

    // ── Match Result ──
    'match.title': '매치 점수',
    'match.subtitle': '이력서-채용공고 적합도',
    'match.matchedKeywords': '일치 키워드',
    'match.missingKeywords': '누락 키워드',
    'match.requiredSkills': '필수 스킬',
    'match.preferredSkills': '우대 스킬',
    'match.suggestedEdits': '수정 제안',

    // ── Error Page ──
    'error.title': '문제가 발생했습니다',
    'error.description': '예상치 못한 오류가 발생했습니다. 다시 시도해 주세요.',
    'error.retry': '다시 시도',

    // ── Agent Error ──
    'agentError.title': '에이전트 오류',
    'agentError.description': '에이전트에 오류가 발생했습니다. 대화를 다시 시작해 주세요.',
    'agentError.retry': '다시 시도',
    'agentError.home': '홈으로',

    // ── 404 ──
    'notFound.subtitle': '페이지를 찾을 수 없습니다',
    'notFound.home': '홈으로',
    'notFound.agent': '에이전트 시작',

    // ── Toast ──
    'toast.close': '알림 닫기',

    // ── Theme ──
    'theme.light': '라이트',
    'theme.dark': '다크',
    'theme.system': '시스템',
    'theme.toggle': '테마 변경',
  },

  en: {
    'nav.home': 'My Offer Agent',

    'landing.badge': 'AI Career Agent',
    'landing.title1': 'My Offer',
    'landing.title2': 'Agent',
    'landing.subtitle':
      'From resume building to job matching,\nAI guides you through every step of your career journey',
    'landing.cta': 'Get Started',
    'landing.flowTitle': 'Agent Workflow',

    'step.triage': 'Triage',
    'step.triage.desc': 'Identifies your needs and routes you to the right agent',
    'step.builder': 'Builder',
    'step.builder.desc': 'Builds an ATS-friendly resume through conversation',
    'step.analyzer': 'Analyzer',
    'step.analyzer.desc': 'Analyzes your resume with a detailed 100-point score',
    'step.scout': 'Scout',
    'step.scout.desc': 'Searches the web for matching job postings in real-time',
    'step.match': 'Match',
    'step.match.desc': 'Evaluates fit between your resume and job descriptions',
    'step.writer': 'Writer',
    'step.writer.desc': 'Generates tailored cover letters and optimized resumes',

    'chat.placeholder': 'Type a message...',
    'chat.welcome':
      "Hi! I'm **My Offer Agent**.\nI can help with resume writing, ATS analysis, and job matching. What would you like to start with?",
    'chat.error': 'Failed to get a response. Please try again.',
    'chat.agentSwitch': 'Switched to {agent}',
    'chat.pdfLabel': 'PDF Resume',
    'chat.analyzeAuto': 'Please analyze my resume.',
    'chat.downloadResume': 'Download Resume (.md)',
    'chat.downloadResumePdf': 'Save as PDF',
    'chat.fileSizeError': 'File size must be under 10MB.',
    'chat.pdfError': 'Unable to read the PDF file.',
    'chat.pdfTooltip': 'Attach PDF',
    'chat.send': 'Send',
    'chat.removeFile': 'Remove attached file',
    'chat.olderHidden': '{count} older messages hidden',
    'chat.messageList': 'Chat messages',
    'chat.loading': 'Generating response...',
    'chat.retry': 'Retry',

    'sidebar.title': 'Agents',
    'sidebar.done': 'Done',
    'sidebar.step': '{current} / {total}',
    'sidebar.newChat': 'New Chat',

    'job.analyze': 'Analyze',
    'job.viewPosting': 'View Posting',
    'job.remote': 'Remote',
    'job.onsite': 'Onsite',
    'job.hybrid': 'Hybrid',

    'ats.title': 'ATS Compatibility Score',
    'ats.formatCompatibility': 'Format Compatibility',
    'ats.keywordOptimization': 'Keyword Optimization',
    'ats.achievementQuality': 'Achievement Quality',
    'ats.structuralCompleteness': 'Structural Completeness',
    'ats.readability': 'Readability',
    'ats.grammar': 'Grammar & Spelling',
    'ats.strengths': 'Strengths',
    'ats.improvements': 'Improvements',

    'match.title': 'Match Score',
    'match.subtitle': 'Resume-JD Fit',
    'match.matchedKeywords': 'Matched Keywords',
    'match.missingKeywords': 'Missing Keywords',
    'match.requiredSkills': 'Required Skills',
    'match.preferredSkills': 'Preferred Skills',
    'match.suggestedEdits': 'Suggested Edits',

    'error.title': 'Something went wrong',
    'error.description': 'An unexpected error occurred. Please try again.',
    'error.retry': 'Try again',

    'agentError.title': 'Agent Error',
    'agentError.description': 'The agent encountered an error. Please try restarting the conversation.',
    'agentError.retry': 'Retry',
    'agentError.home': 'Home',

    'notFound.subtitle': 'Page not found',
    'notFound.home': 'Home',
    'notFound.agent': 'Start Agent',

    'toast.close': 'Close notification',

    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
    'theme.toggle': 'Toggle theme',
  },
};

export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string>,
): string {
  let text = dict[locale]?.[key] ?? dict.ko[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}
