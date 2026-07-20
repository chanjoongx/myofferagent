'use client';

/**
 * 인라인 편집 필드
 * ------------------------------------------------------------------
 * "클릭하면 입력창으로 바뀌는" 방식 대신 **항상 입력 요소**를 렌더링하되
 * 평소에는 일반 텍스트처럼 보이게 했습니다.
 *
 * 이렇게 한 이유:
 *  - 모드 전환이 없어 상태 관리가 단순합니다
 *  - 키보드 사용자가 Tab만으로 모든 필드를 오갈 수 있습니다 (접근성)
 *  - 모바일에서 "정확히 눌러야 편집 모드 진입" 문제가 사라집니다
 */

import { useRef, useEffect, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** 표시용 추가 클래스 (크기·굵기 등) */
  className?: string;
  ariaLabel: string;
}

const BASE =
  'w-full bg-transparent outline-none rounded px-1 -mx-1 transition-colors ' +
  'border border-transparent hover:border-surface-border ' +
  'focus:border-accent/50 focus:bg-surface/40 ' +
  'placeholder:text-text-secondary/40 placeholder:italic';

export default function EditableText({
  value,
  onChange,
  placeholder,
  multiline = false,
  className = '',
  ariaLabel,
}: EditableTextProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** textarea 높이를 내용에 맞춰 조정 */
  const autoSize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (multiline) autoSize();
  }, [value, multiline, autoSize]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (multiline) autoSize();
  };

  // Escape로 포커스를 빠져나갈 수 있게 합니다 (모바일 키보드 닫기)
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') e.currentTarget.blur();
  };

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`${BASE} resize-none overflow-hidden ${className}`}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={`${BASE} ${className}`}
    />
  );
}
