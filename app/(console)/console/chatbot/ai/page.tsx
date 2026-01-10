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
  FlaskConical,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type {
  ExperimentConfig,
  ChunkingStrategy,
} from '@/types/experiment';
import { DEFAULT_EXPERIMENT_CONFIG } from '@/types/experiment';
import { QualityDashboardCard } from './_components/quality-dashboard-card';

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
  /** 분석에 사용된 청크 수 */
  chunkSampleCount?: number;
  /** 분석에 포함된 고유 문서 수 */
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
    experimentConfig: ExperimentConfig | null;
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

  // 실험 설정 상태 (Phase 5: A/B 테스트)
  const [experimentConfig, setExperimentConfig] = useState<ExperimentConfig>(
    DEFAULT_EXPERIMENT_CONFIG
  );

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
          chunkSampleCount: chatbot.ragIndexConfig.chunkSampleCount,
          documentSampleCount: chatbot.ragIndexConfig.documentSampleCount ?? 0,
        });
      }

      // 실험 설정 (Phase 5: A/B 테스트)
      if (chatbot.experimentConfig) {
        setExperimentConfig({
          chunkingStrategy: chatbot.experimentConfig.chunkingStrategy ?? 'auto',
          abTestEnabled: chatbot.experimentConfig.abTestEnabled ?? false,
          semanticTrafficPercent: chatbot.experimentConfig.semanticTrafficPercent ?? 50,
          experimentStartedAt: chatbot.experimentConfig.experimentStartedAt,
          experimentEndedAt: chatbot.experimentConfig.experimentEndedAt,
          experimentNote: chatbot.experimentConfig.experimentNote,
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
          experimentConfig,
        }),
      });

      if (!response.ok) {
        throw new Error('설정 저장에 실패했습니다');
      }
      toast.success('설정이 저장되었습니다');
    } catch (error) {
      console.error('설정 저장 오류:', error);
      toast.error('설정 저장에 실패했습니다');
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

  // 페르소나만 자동 생성 (RAG 인덱스는 업데이트하지 않음, 이름은 기존 값 유지)
  const handleGeneratePersonaOnly = async () => {
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

      // 페르소나 필드만 업데이트 (이름은 기존 값 유지, RAG 인덱스는 무시)
      if (data.persona) {
        setPersonaConfig({
          name: personaConfig.name, // 기존 이름 유지
          expertiseArea: data.persona.expertiseArea ?? '',
          expertiseDescription: data.persona.expertiseDescription ?? '',
          tone: data.persona.tone ?? 'friendly',
        });
      }

      toast.success('페르소나가 자동 생성되었습니다');
    } catch (error) {
      console.error('페르소나 생성 오류:', error);
      toast.error(
        error instanceof Error ? error.message : '페르소나 생성에 실패했습니다'
      );
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
                <span>
                  분석: {ragIndexConfig.documentSampleCount}개 문서
                  {ragIndexConfig.chunkSampleCount && ` (${ragIndexConfig.chunkSampleCount}개 청크)`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 페르소나 설정 카드 - 사용자 편집 가능 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <CardTitle>페르소나 설정</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGeneratePersonaOnly}
                disabled={isGenerating || !hasContent}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                자동 생성
              </Button>
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

        {/* 실험 설정 카드 (Phase 5: A/B 테스트) */}
        <Card size="md" className="border-orange-500/20 bg-orange-500/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-orange-500" />
              <CardTitle>청킹 실험 설정</CardTitle>
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-500">
                A/B 테스트
              </span>
            </div>
            <CardDescription>
              문서 청킹 전략과 A/B 테스트 설정을 관리합니다. 새로 업로드되는 문서에 적용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 청킹 전략 선택 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                청킹 전략
              </label>
              <select
                value={experimentConfig.chunkingStrategy}
                onChange={(e) =>
                  setExperimentConfig((prev) => ({
                    ...prev,
                    chunkingStrategy: e.target.value as ChunkingStrategy,
                  }))
                }
                disabled={experimentConfig.abTestEnabled}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="auto">자동 (환경 설정 따름)</option>
                <option value="smart">규칙 기반 (Smart)</option>
                <option value="semantic">AI 의미 기반 (Semantic)</option>
                <option value="late">Late Chunking</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {experimentConfig.abTestEnabled
                  ? 'A/B 테스트 활성화 시 Smart vs Semantic으로 자동 분배됩니다'
                  : '문서를 청크로 분할하는 방식을 선택합니다'}
              </p>
            </div>

            {/* 청킹 전략 상세 설명 */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">청킹 방식 비교</p>

              {/* Smart (규칙 기반) */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-blue-500/10 text-xs font-bold text-blue-500">S</span>
                  <span className="text-sm font-medium text-foreground">규칙 기반 (Smart)</span>
                  <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-500">무료</span>
                </div>
                <p className="pl-7 text-xs text-muted-foreground">
                  한국어 종결어미 패턴과 문서 구조(헤더, Q&A, 테이블)를 인식하여 분할합니다.
                  문서 유형(FAQ, 기술문서, 법률문서)을 자동 감지하여 최적 설정을 적용합니다.
                  빠르고 예측 가능하며 비용이 들지 않습니다.
                </p>
              </div>

              {/* Semantic (AI 의미 기반) */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-purple-500/10 text-xs font-bold text-purple-500">A</span>
                  <span className="text-sm font-medium text-foreground">AI 의미 기반 (Semantic)</span>
                  <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs text-orange-500">포인트 사용</span>
                </div>
                <p className="pl-7 text-xs text-muted-foreground">
                  Claude Haiku AI가 문맥을 이해하여 의미적으로 완결된 단위로 분할합니다.
                  3단계 파이프라인(Pre-chunk → AI 분석 → Post-process)으로 동작하며,
                  Q&A 쌍, 코드 블록, 테이블 등을 자동 인식합니다. 프롬프트 캐싱으로 90% 비용 절감.
                </p>
              </div>

              {/* Late Chunking */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-cyan-500/10 text-xs font-bold text-cyan-500">L</span>
                  <span className="text-sm font-medium text-foreground">Late Chunking</span>
                  <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-xs text-cyan-500">실험적</span>
                </div>
                <p className="pl-7 text-xs text-muted-foreground">
                  전체 문서를 먼저 임베딩한 후 청크별로 풀링합니다 (Jina AI 연구 기반).
                  문맥 정보가 임베딩에 보존되어 검색 품질이 향상됩니다.
                  3가지 풀링 전략(평균/최대/가중치) 중 품질 기반 가중치 풀링이 기본값입니다.
                </p>
              </div>
            </div>

            {/* A/B 테스트 토글 */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                {experimentConfig.abTestEnabled ? (
                  <ToggleRight className="h-6 w-6 text-orange-500" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-foreground">A/B 테스트</p>
                  <p className="text-xs text-muted-foreground">
                    Smart와 Semantic 전략을 비교 테스트합니다
                  </p>
                </div>
              </div>
              <Button
                variant={experimentConfig.abTestEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  setExperimentConfig((prev) => ({
                    ...prev,
                    abTestEnabled: !prev.abTestEnabled,
                    // A/B 테스트 활성화 시 시작일 자동 설정
                    experimentStartedAt: !prev.abTestEnabled
                      ? new Date().toISOString()
                      : prev.experimentStartedAt,
                  }))
                }
              >
                {experimentConfig.abTestEnabled ? '활성화됨' : '비활성화'}
              </Button>
            </div>

            {/* A/B 테스트 세부 설정 (활성화 시에만 표시) */}
            {experimentConfig.abTestEnabled && (
              <div className="space-y-4 rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
                {/* 트래픽 비율 */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Semantic 트래픽 비율
                    </label>
                    <span className="text-sm text-muted-foreground">
                      {experimentConfig.semanticTrafficPercent ?? 50}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={experimentConfig.semanticTrafficPercent ?? 50}
                    onChange={(e) =>
                      setExperimentConfig((prev) => ({
                        ...prev,
                        semanticTrafficPercent: parseInt(e.target.value),
                      }))
                    }
                    className="w-full accent-orange-500"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>Smart (대조군): {100 - (experimentConfig.semanticTrafficPercent ?? 50)}%</span>
                    <span>Semantic (처리군): {experimentConfig.semanticTrafficPercent ?? 50}%</span>
                  </div>
                </div>

                {/* 실험 기간 */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      시작일
                    </label>
                    <input
                      type="date"
                      value={
                        experimentConfig.experimentStartedAt
                          ? new Date(experimentConfig.experimentStartedAt)
                              .toISOString()
                              .split('T')[0]
                          : ''
                      }
                      onChange={(e) =>
                        setExperimentConfig((prev) => ({
                          ...prev,
                          experimentStartedAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : undefined,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      종료일 (선택)
                    </label>
                    <input
                      type="date"
                      value={
                        experimentConfig.experimentEndedAt
                          ? new Date(experimentConfig.experimentEndedAt)
                              .toISOString()
                              .split('T')[0]
                          : ''
                      }
                      onChange={(e) =>
                        setExperimentConfig((prev) => ({
                          ...prev,
                          experimentEndedAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : undefined,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* 실험 메모 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    실험 메모
                  </label>
                  <textarea
                    rows={2}
                    value={experimentConfig.experimentNote ?? ''}
                    onChange={(e) =>
                      setExperimentConfig((prev) => ({
                        ...prev,
                        experimentNote: e.target.value || undefined,
                      }))
                    }
                    placeholder="실험 목적이나 가설을 기록하세요"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 품질 대시보드 (Phase 5) */}
        <QualityDashboardCard chatbotId={currentChatbot.id} />

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
