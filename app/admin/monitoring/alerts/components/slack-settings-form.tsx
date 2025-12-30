'use client';

/**
 * Slack 알림 설정 폼
 * Webhook URL과 알림 유형별 활성화 설정을 관리합니다.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SlackSettings } from '../actions';
import { saveSlackSettings } from '../actions';

interface SlackSettingsFormProps {
  settings: SlackSettings | null;
}

export function SlackSettingsForm({ settings }: SlackSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    webhookUrl: settings?.webhookUrl || '',
    channelName: settings?.channelName || '',
    enableBudgetAlerts: settings?.enableBudgetAlerts ?? true,
    enableAnomalyAlerts: settings?.enableAnomalyAlerts ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.webhookUrl.startsWith('https://hooks.slack.com/')) {
      setMessage({ type: 'error', text: '유효한 Slack Webhook URL을 입력해주세요.' });
      return;
    }

    const result = await saveSlackSettings(formData);

    if (result) {
      setMessage({ type: 'success', text: 'Slack 설정이 저장되었습니다.' });
      startTransition(() => {
        router.refresh();
      });
    } else {
      setMessage({ type: 'error', text: '설정 저장에 실패했습니다.' });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* 헤더 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <SlackIcon className="h-6 w-6 text-purple-500" />
          <div>
            <h2 className="font-semibold text-foreground">Slack 알림 설정</h2>
            <p className="text-sm text-muted-foreground">
              {settings?.webhookUrl ? '연결됨' : '설정 필요'}
            </p>
          </div>
        </div>
        <ChevronIcon className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 폼 */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="border-t border-border p-4">
          <div className="space-y-4">
            {/* Webhook URL */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Slack Webhook URL
              </label>
              <input
                type="url"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Slack 앱에서 Incoming Webhook을 생성하고 URL을 입력하세요.
              </p>
            </div>

            {/* 채널명 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                채널명 (선택)
              </label>
              <input
                type="text"
                value={formData.channelName}
                onChange={(e) => setFormData({ ...formData, channelName: e.target.value })}
                placeholder="#alerts"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 알림 유형 설정 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">알림 유형</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enableBudgetAlerts}
                    onChange={(e) => setFormData({ ...formData, enableBudgetAlerts: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">예산 알림 (경고/위험/초과)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enableAnomalyAlerts}
                    onChange={(e) => setFormData({ ...formData, enableAnomalyAlerts: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">이상 징후 알림 (급증 탐지)</span>
                </label>
              </div>
            </div>

            {/* 메시지 */}
            {message && (
              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  message.type === 'success'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* 저장 버튼 */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? '저장 중...' : '설정 저장'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
