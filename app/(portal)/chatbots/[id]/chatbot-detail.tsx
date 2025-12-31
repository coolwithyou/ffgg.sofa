/**
 * 챗봇 상세 컨테이너 컴포넌트
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Settings,
  Globe,
  MessageCircle,
  Database,
  BarChart3,
  Pencil,
  Check,
  X,
  User,
} from 'lucide-react';
import { DatasetManager } from './dataset-manager';
import { WidgetSettings } from './widget-settings';
import { KakaoSettings } from './kakao-settings';
import { LlmSettings } from './llm-settings';
import { PersonaSettings } from './persona-settings';

interface ChatbotData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  widgetEnabled: boolean;
  kakaoEnabled: boolean;
  llmConfig: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string | null;
  };
  searchConfig: {
    maxChunks?: number;
    minScore?: number;
  };
  datasets: Array<{
    id: string;
    name: string;
    documentCount: number;
    chunkCount: number;
    weight: number;
  }>;
  stats: {
    datasetCount: number;
    conversations: {
      total: number;
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
  };
}

interface ChatbotDetailProps {
  chatbotId: string;
}

type TabType = 'datasets' | 'widget' | 'kakao' | 'settings' | 'persona';

export function ChatbotDetail({ chatbotId }: ChatbotDetailProps) {
  const router = useRouter();
  const [chatbot, setChatbot] = useState<ChatbotData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('datasets');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchChatbot();
  }, [chatbotId]);

  const fetchChatbot = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chatbots/${chatbotId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('챗봇을 찾을 수 없습니다');
        } else {
          setError('챗봇 정보를 불러오는데 실패했습니다');
        }
        return;
      }
      const data = await response.json();
      setChatbot(data.chatbot);
      setEditName(data.chatbot.name);
      setEditDescription(data.chatbot.description || '');
    } catch (err) {
      setError('챗봇 정보를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatbot((prev) =>
          prev
            ? {
                ...prev,
                name: data.chatbot.name,
                description: data.chatbot.description,
              }
            : null
        );
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !chatbot) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {error || '챗봇을 찾을 수 없습니다'}
        </h3>
        <Link
          href="/chatbots"
          className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          챗봇 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'datasets' as const, label: '데이터셋', icon: Database },
    { id: 'widget' as const, label: '위젯 배포', icon: Globe },
    { id: 'kakao' as const, label: '카카오 연동', icon: MessageCircle },
    { id: 'settings' as const, label: 'LLM 설정', icon: Settings },
    { id: 'persona' as const, label: '페르소나', icon: User },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/chatbots"
            className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-lg font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="챗봇 이름"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="설명 (선택사항)"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editName.trim()}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(chatbot.name);
                      setEditDescription(chatbot.description || '');
                    }}
                    className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">
                    {chatbot.name}
                  </h1>
                  {chatbot.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      기본
                    </span>
                  )}
                  {chatbot.status === 'inactive' && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      비활성
                    </span>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                {chatbot.description && (
                  <p className="mt-1 text-muted-foreground">
                    {chatbot.description}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="flex gap-4">
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" />
              <span className="text-xs">데이터셋</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {chatbot.stats.datasetCount}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">이번 달 대화</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {chatbot.stats.conversations.thisMonth}
            </p>
          </div>
        </div>
      </div>

      {/* 배포 상태 */}
      <div className="flex gap-4">
        {chatbot.widgetEnabled && (
          <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-500">
            <Globe className="h-4 w-4" />
            <span>위젯 활성화됨</span>
          </div>
        )}
        {chatbot.kakaoEnabled && (
          <div className="flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1 text-sm text-yellow-500">
            <MessageCircle className="h-4 w-4" />
            <span>카카오 연동됨</span>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="min-h-[400px]">
        {activeTab === 'datasets' && (
          <DatasetManager
            chatbotId={chatbotId}
            linkedDatasets={chatbot.datasets}
            onUpdate={fetchChatbot}
          />
        )}
        {activeTab === 'widget' && (
          <WidgetSettings
            chatbotId={chatbotId}
            hasDatasets={chatbot.stats.datasetCount > 0}
            onUpdate={fetchChatbot}
          />
        )}
        {activeTab === 'kakao' && (
          <KakaoSettings
            chatbotId={chatbotId}
            hasDatasets={chatbot.stats.datasetCount > 0}
            onUpdate={fetchChatbot}
          />
        )}
        {activeTab === 'settings' && (
          <LlmSettings
            chatbotId={chatbotId}
            llmConfig={chatbot.llmConfig}
            searchConfig={chatbot.searchConfig}
            onUpdate={fetchChatbot}
          />
        )}
        {activeTab === 'persona' && (
          <PersonaSettings
            chatbotId={chatbotId}
            onUpdate={fetchChatbot}
          />
        )}
      </div>
    </div>
  );
}
