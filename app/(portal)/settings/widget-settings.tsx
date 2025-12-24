'use client';

/**
 * 위젯 설정 폼
 * [Week 9] 웹 위젯 외관 설정
 */

import { useState, useTransition } from 'react';
import { updateWidgetSettings } from './actions';

interface WidgetSettingsFormProps {
  initialData: {
    primaryColor: string;
    title: string;
    subtitle: string;
    placeholder: string;
  };
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#6366F1', // Indigo
];

export function WidgetSettingsForm({ initialData }: WidgetSettingsFormProps) {
  const [formData, setFormData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await updateWidgetSettings(formData);

      if (result.success) {
        setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
      } else {
        setMessage({ type: 'error', text: result.error || '저장에 실패했습니다.' });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 기본 색상 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">기본 색상</label>
        <div className="mt-2 flex items-center gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, primaryColor: color })}
              className={`h-8 w-8 rounded-full border-2 transition-transform ${
                formData.primaryColor === color
                  ? 'scale-110 border-gray-900'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <input
            type="color"
            value={formData.primaryColor}
            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border"
          />
        </div>
      </div>

      {/* 제목 */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          제목
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="무엇을 도와드릴까요?"
          className="mt-1 block w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 부제목 */}
      <div>
        <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700">
          부제목
        </label>
        <input
          type="text"
          id="subtitle"
          value={formData.subtitle}
          onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
          placeholder="질문을 입력해주세요"
          className="mt-1 block w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 입력 placeholder */}
      <div>
        <label htmlFor="placeholder" className="block text-sm font-medium text-gray-700">
          입력 안내 텍스트
        </label>
        <input
          type="text"
          id="placeholder"
          value={formData.placeholder}
          onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
          placeholder="메시지를 입력하세요..."
          className="mt-1 block w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 미리보기 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">미리보기</label>
        <div className="mt-2 overflow-hidden rounded-lg border shadow-lg">
          {/* 헤더 */}
          <div
            className="px-4 py-3 text-white"
            style={{ backgroundColor: formData.primaryColor }}
          >
            <h3 className="font-semibold">{formData.title || '제목'}</h3>
            <p className="text-sm opacity-90">{formData.subtitle || '부제목'}</p>
          </div>
          {/* 메시지 영역 */}
          <div className="h-24 bg-gray-50 p-3">
            <div className="inline-block rounded-lg bg-gray-200 px-3 py-2 text-sm">
              안녕하세요! 무엇을 도와드릴까요?
            </div>
          </div>
          {/* 입력 영역 */}
          <div className="border-t bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={formData.placeholder || '메시지 입력...'}
                disabled
                className="flex-1 rounded border px-3 py-2 text-sm"
              />
              <div
                className="flex h-9 w-9 items-center justify-center rounded text-white"
                style={{ backgroundColor: formData.primaryColor }}
              >
                ↑
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`rounded-md p-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 저장 버튼 */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-blue-600 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? '저장 중...' : '위젯 설정 저장'}
      </button>
    </form>
  );
}
