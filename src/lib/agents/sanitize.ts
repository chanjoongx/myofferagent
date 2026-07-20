/**
 * 신뢰할 수 없는 텍스트를 프롬프트에 넣기 위한 처리
 * ------------------------------------------------------------------
 * 이력서 원문, 웹 검색 결과, 사용자가 채운 필드는 모두 **데이터**이지 지시문이
 * 아닙니다. 하지만 LLM에게는 둘 다 그냥 토큰이라, 경계를 코드로 강제해야 합니다.
 *
 * ## 이전 구현의 결함
 *
 * ```ts
 * input += `\n\n<<<RESUME_TEXT_START>>>\n${resumeText}\n<<<RESUME_TEXT_END>>>`;
 * ```
 *
 * 데이터 안에 있는 닫는 마커를 제거하지 않았습니다. 이력서에
 * `<<<RESUME_TEXT_END>>>` 한 줄만 넣으면 울타리를 빠져나와 그 뒤 내용이
 * 지시문처럼 취급됩니다. 울타리의 존재 이유가 통째로 사라집니다.
 *
 * 여기서는 마커를 **먼저 제거**한 뒤 감쌉니다. 길이도 함께 제한해
 * 컨텍스트 폭주와 비용 증폭을 막습니다.
 */

/**
 * 울타리 문법 무력화.
 *
 * ⚠️ 예전 구현은 마커 전체를 정규식 하나로 잡았습니다:
 *   `/<{2,}\s*\/?[A-Z0-9_]{2,}\s*>{2,}/g`
 * `<`가 길게 이어지면 `<{2,}`가 탐욕적으로 먹었다가 되돌아오기를 반복해
 * **2차 시간**으로 폭발했습니다. 실측: 20k → 0.9초, 40k → 3.4초, 60k → 7.9초.
 * 이력서 원문 상한이 60k이므로 업로드 한 번으로 Worker CPU 8초를 태울 수 있었습니다.
 *
 * 지금은 **연속된 꺾쇠를 접기만** 합니다. 문자 클래스 하나의 반복이라
 * 되돌아갈 지점이 없어 선형입니다.
 *
 * 3개 이상만 2개로 접는 이유: 울타리는 `<<<`가 있어야 성립하므로 3개를 막으면
 * 닫을 수 없습니다. 반면 2개까지 살려 두면 **개발자 이력서의 실제 코드가
 * 망가지지 않습니다** — `HashMap<String, List<Integer>>`, `cout << x << endl`.
 * (2개 이상을 1개로 접었더니 바로 이 표현들이 깨졌습니다.)
 */
const ANGLE_RUN_OPEN = /<{3,}/g;
const ANGLE_RUN_CLOSE = />{3,}/g;

/**
 * 프롬프트 안에서 지시문처럼 읽힐 수 있는 상용구.
 * 완벽한 차단은 불가능하지만(자연어라 우회 가능), 가장 흔한 형태를 눈에 띄게
 * 만들어 모델이 "데이터 안의 명령"임을 알아채기 쉽게 합니다.
 */
const IMPERATIVE = /\b(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/gi;

export interface FenceOptions {
  /** 최대 길이 (문자). 초과분은 잘라내고 표시를 남깁니다. */
  maxLength: number;
}

/**
 * 신뢰할 수 없는 텍스트를 울타리로 감싼다.
 *
 * @param label 대문자 라벨 (예: 'RESUME_TEXT')
 * @param text  신뢰할 수 없는 원문
 */
export function fence(label: string, text: string, options: FenceOptions): string {
  const cleaned = scrub(text, options.maxLength);
  return `<<<${label}_START>>>\n${cleaned}\n<<<${label}_END>>>`;
}

/**
 * 울타리 없이 문장 안에 끼워 넣어야 하는 짧은 값(직무명 등)을 정리한다.
 * 줄바꿈을 없애 프롬프트의 구조를 깨뜨리지 못하게 합니다.
 */
export function inlineValue(text: string, maxLength = 120): string {
  return scrub(text, maxLength).replace(/[\r\n]+/g, ' ').trim();
}

/** 마커 무력화 + 명령형 상용구 제거 + 길이 제한 */
export function scrub(text: string, maxLength: number): string {
  // ⚠️ **먼저 자릅니다.** 예전에는 전체 문자열에 정규식을 돌린 뒤에 잘랐는데,
  // 그러면 길이 제한이 정규식 비용을 전혀 막아 주지 못했습니다
  // (`inlineValue`는 120자로 자르지만 60k 입력 전체를 스캔했습니다).
  const truncated = text.length > maxLength ? text.slice(0, maxLength) + '\n…[truncated]' : text;

  return truncated
    .replace(ANGLE_RUN_OPEN, '<<')
    .replace(ANGLE_RUN_CLOSE, '>>')
    .replace(IMPERATIVE, '[instruction-like text removed]');
}
