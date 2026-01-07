'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { NoChatbotState } from '../../components/no-chatbot-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Brain,
  Sparkles,
  Search,
  MessageSquare,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type RagIndexStatus = 'idle' | 'generating' | 'completed' | 'failed';

interface LlmConfig {
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
}

interface SearchConfig {
  maxChunks: number;
  minScore: number;
}

// 페르소나 설정 (사용자 편집 가능)
interface PersonaConfig {
  name: string;
  expertiseArea: string;
  expertiseDescription?: string;
  tone: 'professional' | 'friendly' | 'casual';
}

// RAG 인덱스 설정 (AI 자동 생성, 읽기 전용)
interface RagIndexConfig {
  keywords: string[];
  includedTopics: string[];
  excludedTopics: string[];
  confidence: number | null;
  lastGeneratedAt: string | null;
  documentSampleCount: number;
}

interface DatasetInfo {
  id: string;
  name: string;
  chunkCount: number;
}

interface ChatbotData {
  chatbot: {
    llmConfig: LlmConfig;
    searchConfig: SearchConfig;
    personaConfig: PersonaConfig;
    ragIndexConfig: RagIndexConfig;
    datasets: DatasetInfo[];
    updatedAt: string;
    contentUpdatedAt: string | null;
  };
}

/**
 * 챗봇 > AI 설정 페이지
 *
 * LLM 설정과 페르소나 설정을 관리하는 페이지
 * RAG 파이프라인의 "게이트" 역할을 하는 핵심 설정
 */
export default function AISettingsPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // RAG 인덱스 생성 상태 (백그라운드 자동 생성 모니터링)
  const [ragStatus, setRagStatus] = useState<RagIndexStatus>('idle');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const prevStatusRef = useRef<RagIndexStatus>('idle');

  // 데이터셋 정보 상태
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  // 콘텐츠(데이터셋, 문서) 변경 시점 - 페르소나 재생성 필요 여부 판단에 사용
  const [contentUpdatedAt, setContentUpdatedAt] = useState<string | null>(null);

  // LLM 설정 상태
  const [llmConfig, setLlmConfig] = useState<LlmConfig>({
    temperature: 0.7,
    maxTokens: 1024,
    systemPrompt: '',
  });

  // 검색 설정 상태
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    maxChunks: 5,
    minScore: 0.5,
  });

  // 페르소나 설정 상태 (사용자 편집 가능)
  const [personaConfig, setPersonaConfig] = useState<PersonaConfig>({
    name: 'AI 어시스턴트',
    expertiseArea: '',
    expertiseDescription: '',
    tone: 'friendly',
  });

  // RAG 인덱스 설정 상태 (AI 자동 생성, 읽기 전용)
  const [ragIndexConfig, setRagIndexConfig] = useState<RagIndexConfig>({
    keywords: [],
    includedTopics: [],
    excludedTopics: [],
    confidence: null,
    lastGeneratedAt: null,
    documentSampleCount: 0,
  });

  // 페르소나 업데이트 필요 여부 체크
  // contentUpdatedAt: 데이터셋 연결/해제 등 RAG에 영향을 주는 변경만 추적
  const needsPersonaUpdate = (): boolean => {
    if (!ragIndexConfig.lastGeneratedAt) return true;
    if (!contentUpdatedAt) return false;

    const ragDate = new Date(ragIndexConfig.lastGeneratedAt);
    const contentDate = new Date(contentUpdatedAt);

    // 콘텐츠가 RAG 인덱스 생성 이후에 변경되었으면 갱신 필요
    return contentDate > ragDate;
  };

  const hasDatasets = datasets.length > 0;
  const totalChunks = datasets.reduce((sum, d) => sum + d.chunkCount, 0);
  // 청크가 1개 이상 있어야 페르소나/RAG 인덱스 재생성 가능
  const hasContent = totalChunks > 0;

  // 챗봇 데이터 로드 함수 (재사용 가능하도록 useCallback으로 래핑)
  const fetchChatbot = useCallback(async (showLoader = true) => {
    if (!currentChatbot?.id) return;

    if (showLoader) setIsLoading(true);
    try {
      const response = await fetch(`/api/chatbots/${currentChatbot.id}`);
      if (!response.ok) throw new Error('챗봇 데이터를 불러올 수 없습니다');

      const data: ChatbotData = await response.json();
      const { chatbot } = data;

      setDatasets(chatbot.datasets || []);
      setContentUpdatedAt(chatbot.contentUpdatedAt);

      if (chatbot.llmConfig) {
        setLlmConfig({
          temperature: chatbot.llmConfig.temperature ?? 0.7,
          maxTokens: chatbot.llmConfig.maxTokens ?? 1024,
          systemPrompt: chatbot.llmConfig.systemPrompt ?? '',
        });
      }

      if (chatbot.searchConfig) {
        setSearchConfig({
          maxChunks: chatbot.searchConfig.maxChunks ?? 5,
          minScore: chatbot.searchConfig.minScore ?? 0.5,
        });
      }

      // 페르소나 설정 (사용자 편집 가능)
      if (chatbot.personaConfig) {
        setPersonaConfig({
          name: chatbot.personaConfig.name ?? 'AI 어시스턴트',
          expertiseArea: chatbot.personaConfig.expertiseArea ?? '',
          expertiseDescription: chatbot.personaConfig.expertiseDescription ?? '',
          tone: chatbot.personaConfig.tone ?? 'friendly',
        });
      }

      // RAG 인덱스 설정 (AI 자동 생성, 읽기 전용)
      if (chatbot.ragIndexConfig) {
        setRagIndexConfig({
          keywords: chatbot.ragIndexConfig.keywords ?? [],
          includedTopics: chatbot.ragIndexConfig.includedTopics ?? [],
          excludedTopics: chatbot.ragIndexConfig.excludedTopics ?? [],
          confidence: chatbot.ragIndexConfig.confidence ?? null,
          lastGeneratedAt: chatbot.ragIndexConfig.lastGeneratedAt ?? null,
          documentSampleCount: chatbot.ragIndexConfig.documentSampleCount ?? 0,
        });
      }
    } catch (error) {
      console.error('챗봇 데이터 로드 오류:', error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [currentChatbot?.id]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchChatbot();
  }, [fetchChatbot]);

  // RAG 인덱스 상태 폴링
  useEffect(() => {
    if (!currentChatbot?.id) return;

    const checkRagStatus = async () => {
      try {
        const response = await fetch(`/api/chatbots/${currentChatbot.id}/rag-status`);
        if (!response.ok) return;

        const data = await response.json();
        const newStatus = data.status as RagIndexStatus;
        setRagStatus(newStatus);

        // 상태 변화 감지 및 알림
        if (prevStatusRef.current === 'generating' && newStatus === 'completed') {
          // 생성 완료 시 데이터 새로고침 및 알림
          await fetchChatbot(false);
          toast.success('RAG 인덱스 생성 완료', {
            description: '데이터셋 변경에 따라 RAG 검색 인덱스가 자동으로 업데이트되었습니다.',
          });
        } else if (prevStatusRef.current === 'generating' && newStatus === 'failed') {
          // 생성 실패 시 알림
          toast.error('RAG 인덱스 생성 실패', {
            description: 'RAG 검색 인덱스 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
          });
        }

        prevStatusRef.current = newStatus;
      } catch (error) {
        console.error('RAG 상태 조회 오류:', error);
      }
    };

    // 초기 상태 체크
    checkRagStatus();

    // 폴링 시작 (3초마다)
    pollingRef.current = setInterval(checkRagStatus, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [currentChatbot?.id, fetchChatbot]);

  const handleSave = async () => {
    if (!currentChatbot?.id) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/chatbots/${currentChatbot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmConfig,
          searchConfig,
          personaConfig,
        }),
      });

      if (!response.ok) {
        throw new Error('설정 저장에 실패했습니다');
      }
    } catch (error) {
      console.error('설정 저장 오류:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePersona = async () => {
    if (!currentChatbot?.id) return;
    setIsGenerating(true);

    try {
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/generate-persona`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '페르소나 생성에 실패했습니다');
      }

      const data = await response.json();
      // 페르소나 설정 업데이트 (사용자 편집 가능 필드)
      if (data.persona) {
        setPersonaConfig({
          name: data.persona.name ?? personaConfig.name,
          expertiseArea: data.persona.expertiseArea ?? '',
          expertiseDescription: data.persona.expertiseDescription ?? '',
          tone: data.persona.tone ?? 'friendly',
        });
      }
      // RAG 인덱스 설정 업데이트 (AI 자동 생성, 읽기 전용)
      if (data.ragIndex) {
        setRagIndexConfig(data.ragIndex);
      }
    } catch (error) {
      console.error('페르소나 생성 오류:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // 챗봇 없음 상태
  if (!currentChatbot) {
    return <NoChatbotState />;
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AI 설정
        </h1>
        <p className="mt-1 text-muted-foreground">
          챗봇의 AI 동작과 페르소나를 설정합니다
        </p>
      </div>

      <div className="space-y-6">
        {/* 데이터셋-페르소나 연동 알림 */}
        {!hasDatasets ? (
          <Card size="md" className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
              <div>
                <p className="font-medium text-foreground">
                  연결된 데이터셋이 없습니다
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI 페르소나를 자동 생성하려면 먼저 데이터셋을 연결해주세요.
                  데이터셋의 문서를 분석하여 챗봇의 전문 분야와 응답 주제를 자동으로 설정합니다.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => window.location.href = '/console/chatbot/datasets'}
                >
                  데이터셋 관리로 이동
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : needsPersonaUpdate() && ragStatus !== 'generating' ? (
          <Card size="md" className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-start gap-4 pt-6">
              <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  데이터셋이 업데이트되었습니다
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {datasets.length}개의 데이터셋에 총 {totalChunks.toLocaleString()}개의 청크가 있습니다.
                  페르소나를 다시 생성하면 최신 데이터를 반영할 수 있습니다.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="mt-3"
                  onClick={handleGeneratePersona}
                  disabled={isGenerating || !hasContent}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  페르소나 다시 생성
                </Button>
              </div>
              {ragIndexConfig.lastGeneratedAt && (
                <p className="text-xs text-muted-foreground">
                  마지막 생성: {new Date(ragIndexConfig.lastGeneratedAt).toLocaleDateString('ko-KR')}
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* RAG 인덱스 자동 생성 중 알림 배너 */}
        {ragStatus === 'generating' && (
          <Card size="md" className="animate-pulse border-purple-500/30 bg-purple-500/5">
            <CardContent className="flex items-center gap-4 pt-6">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-purple-500" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  RAG 검색 인덱스 자동 생성 중...
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  데이터셋 변경이 감지되어 RAG 검색 인덱스를 자동으로 업데이트하고 있습니다.
                  완료되면 알림을 표시합니다.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* RAG 인덱스 카드 - AI 자동 생성, 읽기 전용 */}
        <Card size="md" className="border-purple-500/20 bg-purple-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-purple-500" />
                <CardTitle>RAG 검색 인덱스</CardTitle>
                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-500">
                  AI 자동 생성
                </span>
              </div>
              <div className="flex items-center gap-2">
                {ragIndexConfig.confidence && (
                  <span className="text-xs text-muted-foreground">
                    신뢰도: {Math.round(ragIndexConfig.confidence * 100)}%
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePersona}
                  disabled={isGenerating || !hasContent}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  다시 생성
                </Button>
              </div>
            </div>
            <CardDescription>
              데이터셋 문서를 분석하여 자동 생성됩니다. 사용자가 수정할 수 없으며, RAG 검색 활성화 조건으로 사용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 키워드 (읽기 전용) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                트리거 키워드
              </label>
              {ragIndexConfig.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ragIndexConfig.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-500"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">아직 생성되지 않았습니다</p>
              )}
            </div>

            {/* 포함 주제 (읽기 전용) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                포함 주제
              </label>
              {ragIndexConfig.includedTopics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ragIndexConfig.includedTopics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-green-500/10 px-3 py-1 text-sm text-green-600 dark:text-green-400"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">아직 생성되지 않았습니다</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                이 주제가 감지되면 RAG 검색을 실행합니다
              </p>
            </div>

            {/* 제외 주제 (읽기 전용) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                제외 주제
              </label>
              {ragIndexConfig.excludedTopics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ragIndexConfig.excludedTopics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-destructive/10 px-3 py-1 text-sm text-destructive"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">아직 생성되지 않았습니다</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                이 주제가 감지되면 RAG 검색을 건너뜁니다
              </p>
            </div>

            {/* 메타 정보 */}
            {ragIndexConfig.lastGeneratedAt && (
              <div className="flex items-center gap-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span>마지막 생성: {new Date(ragIndexConfig.lastGeneratedAt).toLocaleString('ko-KR')}</span>
                <span>분석 문서: {ragIndexConfig.documentSampleCount}개</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 페르소나 설정 카드 - 사용자 편집 가능 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <CardTitle>페르소나 설정</CardTitle>
            </div>
            <CardDescription>
              챗봇의 성격과 응답 스타일을 설정합니다. 자유롭게 수정할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                챗봇 이름
              </label>
              <input
                type="text"
                value={personaConfig.name}
                onChange={(e) =>
                  setPersonaConfig((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="예: 소파 어시스턴트"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 전문 분야 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                전문 분야
              </label>
              <input
                type="text"
                value={personaConfig.expertiseArea}
                onChange={(e) =>
                  setPersonaConfig((prev) => ({
                    ...prev,
                    expertiseArea: e.target.value,
                  }))
                }
                placeholder="예: 고객 서비스, 기술 지원"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 전문 분야 설명 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                전문 분야 설명
              </label>
              <textarea
                rows={3}
                value={personaConfig.expertiseDescription ?? ''}
                onChange={(e) =>
                  setPersonaConfig((prev) => ({
                    ...prev,
                    expertiseDescription: e.target.value,
                  }))
                }
                placeholder="챗봇의 전문 분야에 대한 상세 설명"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 어조 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                응답 어조
              </label>
              <select
                value={personaConfig.tone}
                onChange={(e) =>
                  setPersonaConfig((prev) => ({
                    ...prev,
                    tone: e.target.value as 'professional' | 'friendly' | 'casual',
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="professional">전문적 (Professional)</option>
                <option value="friendly">친근한 (Friendly)</option>
                <option value="casual">캐주얼 (Casual)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* LLM 설정 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-muted-foreground" />
              <CardTitle>LLM 설정</CardTitle>
            </div>
            <CardDescription>
              AI 모델의 응답 생성 방식을 조정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Temperature */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Temperature
                </label>
                <span className="text-sm text-muted-foreground">
                  {llmConfig.temperature}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={llmConfig.temperature}
                onChange={(e) =>
                  setLlmConfig((prev) => ({
                    ...prev,
                    temperature: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                낮을수록 일관된 응답, 높을수록 창의적인 응답을 생성합니다
              </p>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  최대 토큰 수
                </label>
                <span className="text-sm text-muted-foreground">
                  {llmConfig.maxTokens}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="4096"
                step="100"
                value={llmConfig.maxTokens}
                onChange={(e) =>
                  setLlmConfig((prev) => ({
                    ...prev,
                    maxTokens: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                응답의 최대 길이를 제한합니다 (100-4096)
              </p>
            </div>

            {/* System Prompt */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                시스템 프롬프트
              </label>
              <textarea
                rows={4}
                value={llmConfig.systemPrompt ?? ''}
                onChange={(e) =>
                  setLlmConfig((prev) => ({
                    ...prev,
                    systemPrompt: e.target.value,
                  }))
                }
                placeholder="AI의 기본 동작을 정의하는 시스템 프롬프트를 입력하세요"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        {/* 검색 설정 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <CardTitle>검색 설정</CardTitle>
            </div>
            <CardDescription>
              RAG 검색의 동작 방식을 조정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Max Chunks */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  최대 청크 수
                </label>
                <span className="text-sm text-muted-foreground">
                  {searchConfig.maxChunks}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={searchConfig.maxChunks}
                onChange={(e) =>
                  setSearchConfig((prev) => ({
                    ...prev,
                    maxChunks: parseInt(e.target.value),
                  }))
                }
                className="w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                응답 생성에 사용할 최대 문서 청크 수 (1-20)
              </p>
            </div>

            {/* Min Score */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  최소 유사도 점수
                </label>
                <span className="text-sm text-muted-foreground">
                  {searchConfig.minScore}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={searchConfig.minScore}
                onChange={(e) =>
                  setSearchConfig((prev) => ({
                    ...prev,
                    minScore: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                이 점수 이상의 문서만 참조합니다 (0-1)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            설정 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
