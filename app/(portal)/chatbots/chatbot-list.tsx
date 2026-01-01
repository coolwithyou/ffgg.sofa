/**
 * 챗봇 목록 컴포넌트
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  Globe,
  MessageCircle,
  Database,
  Power,
  PowerOff,
} from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';
import type { ChatbotSummary } from './actions';
import { deleteChatbot, updateChatbot } from './actions';

interface ChatbotListProps {
  chatbots: ChatbotSummary[];
}

export function ChatbotList({ chatbots }: ChatbotListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { confirm } = useAlertDialog();
  const { error } = useToast();

  const handleEdit = (chatbot: ChatbotSummary) => {
    setEditingId(chatbot.id);
    setEditName(chatbot.name);
    setEditDescription(chatbot.description || '');
    setMenuOpenId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const result = await updateChatbot(editingId, {
      name: editName,
      description: editDescription,
    });

    if (result.success) {
      setEditingId(null);
    } else {
      error('저장 실패', result.error);
    }
  };

  const handleToggleStatus = async (chatbot: ChatbotSummary) => {
    const newStatus = chatbot.status === 'active' ? 'inactive' : 'active';
    const result = await updateChatbot(chatbot.id, { status: newStatus });

    if (!result.success) {
      error('상태 변경 실패', result.error);
    }
    setMenuOpenId(null);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '챗봇 삭제',
      message: '이 챗봇을 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
    });

    if (!confirmed) return;

    setIsDeleting(true);
    const result = await deleteChatbot(id);
    setIsDeleting(false);
    setMenuOpenId(null);

    if (!result.success) {
      error('삭제 실패', result.error);
    }
  };

  if (chatbots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">챗봇이 없습니다</h3>
        <p className="mt-2 text-muted-foreground">
          새 챗봇을 생성하여 시작하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {chatbots.map((chatbot) => (
        <div
          key={chatbot.id}
          className={`rounded-lg border bg-card p-4 ${
            chatbot.status === 'active' ? 'border-border' : 'border-border opacity-60'
          }`}
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  chatbot.status === 'active'
                    ? 'bg-primary/10'
                    : 'bg-muted'
                }`}
              >
                <Bot
                  className={`h-5 w-5 ${
                    chatbot.status === 'active'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {editingId === chatbot.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                    />
                  ) : (
                    <Link
                      href={`/chatbots/${chatbot.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {chatbot.name}
                    </Link>
                  )}
                  {chatbot.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      <Star className="h-3 w-3" />
                      기본
                    </span>
                  )}
                </div>
                {chatbot.status === 'inactive' && (
                  <span className="text-xs text-muted-foreground">비활성</span>
                )}
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpenId(menuOpenId === chatbot.id ? null : chatbot.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {menuOpenId === chatbot.id && (
                <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                  <button
                    onClick={() => handleEdit(chatbot)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" />
                    수정
                  </button>
                  {!chatbot.isDefault && (
                    <>
                      <button
                        onClick={() => handleToggleStatus(chatbot)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                      >
                        {chatbot.status === 'active' ? (
                          <>
                            <PowerOff className="h-4 w-4" />
                            비활성화
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4" />
                            활성화
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(chatbot.id)}
                        disabled={isDeleting}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        삭제
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 수정 모드 */}
          {editingId === chatbot.id && (
            <div className="mt-3 space-y-2">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                placeholder="설명 (선택사항)"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 설명 */}
          {editingId !== chatbot.id && chatbot.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {chatbot.description}
            </p>
          )}

          {/* 연결 상태 */}
          <div className="mt-4 flex items-center gap-4 border-t border-border pt-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              <span>{chatbot.datasetCount}개 데이터셋</span>
            </div>

            {chatbot.widgetEnabled && (
              <div className="flex items-center gap-1.5 text-sm text-green-500">
                <Globe className="h-4 w-4" />
                <span>위젯</span>
              </div>
            )}

            {chatbot.kakaoEnabled && (
              <div className="flex items-center gap-1.5 text-sm text-yellow-500">
                <MessageCircle className="h-4 w-4" />
                <span>카카오</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
