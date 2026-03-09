"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { extractTextFromPDF } from "@/components/pdf-loader";

interface ResumeUploaderProps {
  onTextExtracted: (text: string) => void;
}

export default function ResumeUploader({ onTextExtracted }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("PDF 파일만 업로드 가능합니다.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("파일 크기는 10MB 이하여야 합니다.");
        return;
      }

      setIsProcessing(true);

      try {
        const extracted = await extractTextFromPDF(file);
        setFileName(file.name);
        onTextExtracted(extracted);
      } catch {
        setError("PDF 파일을 읽을 수 없습니다. 다른 파일을 시도해 주세요.");
      } finally {
        setIsProcessing(false);
      }
    },
    [onTextExtracted]
  );

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (fileName) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-5 py-4">
        <span className="text-xl">✅</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          <p className="text-xs text-text-secondary">업로드 완료</p>
        </div>
        <button
          onClick={() => {
            setFileName(null);
            setError(null);
          }}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          변경
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
          isDragging
            ? "border-accent bg-accent/5"
            : "border-surface-border hover:border-text-secondary/40 hover:bg-surface-elevated/40"
        }`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-sm text-text-secondary">분석 중...</span>
          </div>
        ) : (
          <>
            <span className="text-3xl">📄</span>
            <p className="text-sm text-text-secondary text-center">
              PDF 파일을 드래그하거나 클릭하세요
            </p>
            <p className="text-xs text-text-secondary/60">최대 10MB</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={onChange}
        className="hidden"
      />

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
