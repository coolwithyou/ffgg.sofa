'use client';

/**
 * 위젯 목록 컴포넌트
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Code2,
  Settings,
  ToggleLeft,
  ToggleRight,
  Database,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { ChatbotWithWidgetStatus, toggleWidgetStatus } from './actions';
import { EmbedModal } from './embed-modal';

interface WidgetListProps {
  chatbots: ChatbotWithWidgetStatus[];
}

export function WidgetList({ chatbots }: WidgetListProps) {
  const [items, setItems] = useState(chatbots);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [embedModal, setEmbedModal] = useState<{
    isOpen: boolean;
    chatbot: ChatbotWithWidgetStatus | null;
  }>({ isOpen: false, chatbot: null });

  // 위젯 토글 핸들러
  const handleToggle = async (chatbot: ChatbotWithWidgetStatus) => {
    setLoading(chatbot.id);
    setError(null);

    const result = await toggleWidgetStatus(chatbot.id, !chatbot.widgetEnabled);

    if (result.success) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === chatbot.id
            ? {
                ...item,
                widgetEnabled: !item.widgetEnabled,
                widgetApiKey: result.apiKey || item.widgetApiKey,
              }
            : item
        )
      );
    } else {
      setError(result.error || '오류가 발생했습니다');
    }

    setLoading(null);
  };

  // 임베드 코드 모달 열기
  const openEmbedModal = (chatbot: ChatbotWithWidgetStatus) => {
    setEmbedModal({ isOpen: true, chatbot });
  };

  // 빈 상태
  if (chatbots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Code2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-2 font-medium text-foreground">챗봇이 없습니다</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          먼저 챗봇을 생성하고 데이터셋을 연결해주세요.
        </p>
        <Link
          href="/chatbots"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          챗봇 관리로 이동
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                챗봇
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                상태
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                데이터셋
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((chatbot) => (
              <tr key={chatbot.id} className="hover:bg-muted/50">
                {/* 챗봇 이름 */}
                <td className="px-4 py-4">
                  <div>
                    <div className="font-medium text-foreground">
                      {chatbot.name}
                    </div>
                    {chatbot.description && (
                      <div className="mt-1 text-sm text-muted-foreground line-clamp-1">
                        {chatbot.description}
                      </div>
                    )}
                  </div>
                </td>

                {/* 상태 */}
                <td className="px-4 py-4">
                  <button
                    onClick={() => handleToggle(chatbot)}
                    disabled={loading === chatbot.id}
                    className="flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading === chatbot.id ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : chatbot.widgetEnabled ? (
                      <ToggleRight className="h-6 w-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span
                      className={
                        chatbot.widgetEnabled
                          ? 'text-sm font-medium text-green-500'
                          : 'text-sm text-muted-foreground'
                      }
                    >
                      {chatbot.widgetEnabled ? '활성화' : '비활성화'}
                    </span>
                  </button>
                </td>

                {/* 데이터셋 */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={
                        chatbot.datasetCount > 0
                          ? 'text-sm text-foreground'
                          : 'text-sm text-muted-foreground'
                      }
                    >
                      {chatbot.datasetCount}개
                    </span>
                    {chatbot.datasetCount === 0 && (
                      <span className="ml-1 text-xs text-destructive">
                        (필수)
                      </span>
                    )}
                  </div>
                </td>

                {/* 액션 */}
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {/* 임베드 코드 버튼 */}
                    <button
                      onClick={() => openEmbedModal(chatbot)}
                      disabled={!chatbot.widgetEnabled}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Code2 className="h-4 w-4" />
                      코드
                    </button>

                    {/* 설정 버튼 */}
                    <Link
                      href={`/chatbots/${chatbot.id}?tab=widget`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Settings className="h-4 w-4" />
                      설정
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 임베드 코드 모달 */}
      <EmbedModal
        isOpen={embedModal.isOpen}
        onClose={() => setEmbedModal({ isOpen: false, chatbot: null })}
        chatbot={embedModal.chatbot}
      />
    </>
  );
}
