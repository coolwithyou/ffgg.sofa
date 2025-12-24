'use client';

/**
 * 카카오 설정 폼
 * [Week 9] 카카오 오픈빌더 연동 설정
 */

import { useState, useTransition } from 'react';
import { updateKakaoSettings } from './actions';

interface KakaoSettingsFormProps {
  initialData: {
    botId: string;
    maxResponseLength: number;
    welcomeMessage: string;
  };
}

export function KakaoSettingsForm({ initialData }: KakaoSettingsFormProps) {
  const [formData, setFormData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await updateKakaoSettings(formData);

      if (result.success) {
        setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
      } else {
        setMessage({ type: 'error', text: result.error || '저장에 실패했습니다.' });
      }
    });
  };

  const skillUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/kakao/skill`
    : '/api/kakao/skill';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 봇 ID */}
      <div>
        <label htmlFor="botId" className="block text-sm font-medium text-gray-700">
          봇 ID
        </label>
        <input
          type="text"
          id="botId"
          value={formData.botId}
          onChange={(e) => setFormData({ ...formData, botId: e.target.value })}
          placeholder="카카오 오픈빌더에서 확인"
          className="mt-1 block w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          카카오 오픈빌더 &gt; 설정 &gt; 일반에서 확인할 수 있습니다.
        </p>
      </div>

      {/* 스킬 URL (읽기 전용) */}
      <div>
        <label className="block text-sm font-medium text-gray-700">스킬 URL</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            value={skillUrl}
            readOnly
            className="block w-full rounded-md border bg-gray-50 px-3 py-2 text-gray-600"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(skillUrl)}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            복사
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          이 URL을 카카오 오픈빌더 스킬에 등록하세요.
        </p>
      </div>

      {/* 최대 응답 길이 */}
      <div>
        <label htmlFor="maxResponseLength" className="block text-sm font-medium text-gray-700">
          최대 응답 길이
        </label>
        <input
          type="number"
          id="maxResponseLength"
          value={formData.maxResponseLength}
          onChange={(e) =>
            setFormData({ ...formData, maxResponseLength: parseInt(e.target.value) || 300 })
          }
          min={100}
          max={1000}
          className="mt-1 block w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          카카오톡 메시지 길이 제한을 고려하여 100~1000자 권장
        </p>
      </div>

      {/* 환영 메시지 */}
      <div>
        <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-700">
          환영 메시지
        </label>
        <textarea
          id="welcomeMessage"
          value={formData.welcomeMessage}
          onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
          placeholder="안녕하세요! 무엇을 도와드릴까요?"
          rows={2}
          className="mt-1 block w-full rounded-md border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
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
        className="w-full rounded-md bg-yellow-400 py-2 font-medium text-black transition-colors hover:bg-yellow-500 disabled:opacity-50"
      >
        {isPending ? '저장 중...' : '카카오 설정 저장'}
      </button>
    </form>
  );
}
