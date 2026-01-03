'use client';

/**
 * 연락처 폼 블록 컴포넌트
 *
 * 사용자 정의 폼 필드로 연락처 정보를 수집합니다.
 * - text, email, textarea 필드 타입 지원
 * - 필수 입력 옵션
 * - 커스텀 성공 메시지
 */

import { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContactFormField } from '@/lib/public-page/block-types';

interface ContactFormBlockProps {
  fields: ContactFormField[];
  submitText: string;
  successMessage: string;
}

export function ContactFormBlock({
  fields,
  submitText,
  successMessage,
}: ContactFormBlockProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 폼 제출 핸들러 (데모용)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // 실제 구현에서는 API 호출
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  // 필드가 없으면 플레이스홀더 표시
  if (fields.length === 0) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-border bg-card p-4">
        <span className="text-muted-foreground">폼 필드를 추가하세요</span>
      </div>
    );
  }

  // 제출 완료 상태
  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-center text-foreground">
          {successMessage || '제출이 완료되었습니다!'}
        </p>
        <button
          onClick={() => setIsSubmitted(false)}
          className="text-sm text-primary hover:underline"
        >
          다시 작성하기
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-card p-6"
    >
      {fields.map((field, index) => (
        <div key={index} className="space-y-2">
          <label
            htmlFor={`field-${index}`}
            className="block text-sm font-medium text-foreground"
          >
            {field.label || `필드 ${index + 1}`}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              id={`field-${index}`}
              placeholder={field.placeholder}
              required={field.required}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <input
              id={`field-${index}`}
              type={field.type}
              placeholder={field.placeholder}
              required={field.required}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90',
          isSubmitting && 'cursor-not-allowed opacity-70'
        )}
      >
        {isSubmitting ? (
          <span>제출 중...</span>
        ) : (
          <>
            <Send className="h-4 w-4" />
            <span>{submitText || '제출'}</span>
          </>
        )}
      </button>
    </form>
  );
}
