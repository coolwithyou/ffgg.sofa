'use client';

import { useState, useEffect } from 'react';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Sparkles, Search, MessageSquare, Loader2 } from 'lucide-react';

interface LlmConfig {
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
}

interface SearchConfig {
  maxChunks: number;
  minScore: number;
}

interface PersonaConfig {
  name: string;
  expertiseArea: string;
  expertiseDescription?: string;
  includedTopics?: string[];
  excludedTopics?: string[];
  tone: 'professional' | 'friendly' | 'casual';
}

interface ChatbotData {
  llmConfig: LlmConfig;
  searchConfig: SearchConfig;
  personaConfig: PersonaConfig;
}

/**
 * Settings - AI 설정 페이지
 *
 * LLM 설정과 페르소나 설정을 관리하는 페이지
 */
export default function AISettingsPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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

  // 페르소나 설정 상태
  const [personaConfig, setPersonaConfig] = useState<PersonaConfig>({
    name: 'AI 어시스턴트',
    expertiseArea: '',
    expertiseDescription: '',
    includedTopics: [],
    excludedTopics: [],
    tone: 'friendly',
  });

  // 챗봇 데이터 로드
  useEffect(() => {
    if (!currentChatbot?.id) return;

    const fetchChatbot = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/chatbots/${currentChatbot.id}`);
        if (!response.ok) throw new Error('챗봇 데이터를 불러올 수 없습니다');

        const data: ChatbotData = await response.json();

        if (data.llmConfig) {
          setLlmConfig({
            temperature: data.llmConfig.temperature ?? 0.7,
            maxTokens: data.llmConfig.maxTokens ?? 1024,
            systemPrompt: data.llmConfig.systemPrompt ?? '',
          });
        }

        if (data.searchConfig) {
          setSearchConfig({
            maxChunks: data.searchConfig.maxChunks ?? 5,
            minScore: data.searchConfig.minScore ?? 0.5,
          });
        }

        if (data.personaConfig) {
          setPersonaConfig({
            name: data.personaConfig.name ?? 'AI 어시스턴트',
            expertiseArea: data.personaConfig.expertiseArea ?? '',
            expertiseDescription: data.personaConfig.expertiseDescription ?? '',
            includedTopics: data.personaConfig.includedTopics ?? [],
            excludedTopics: data.personaConfig.excludedTopics ?? [],
            tone: data.personaConfig.tone ?? 'friendly',
          });
        }
      } catch (error) {
        console.error('챗봇 데이터 로드 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatbot();
  }, [currentChatbot?.id]);

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
        throw new Error('페르소나 생성에 실패했습니다');
      }

      const data = await response.json();
      if (data.personaConfig) {
        setPersonaConfig((prev) => ({
          ...prev,
          ...data.personaConfig,
        }));
      }
    } catch (error) {
      console.error('페르소나 생성 오류:', error);
    } finally {
      setIsGenerating(false);
    }
  };

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

        {/* 페르소나 설정 카드 */}
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
                onClick={handleGeneratePersona}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                AI 자동 생성
              </Button>
            </div>
            <CardDescription>
              챗봇의 성격과 전문 분야를 설정합니다
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

            {/* 포함 주제 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                포함 주제
              </label>
              <input
                type="text"
                value={(personaConfig.includedTopics ?? []).join(', ')}
                onChange={(e) =>
                  setPersonaConfig((prev) => ({
                    ...prev,
                    includedTopics: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="쉼표로 구분: 제품 문의, 배송, 환불"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                챗봇이 응답할 주제들
              </p>
            </div>

            {/* 제외 주제 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                제외 주제
              </label>
              <input
                type="text"
                value={(personaConfig.excludedTopics ?? []).join(', ')}
                onChange={(e) =>
                  setPersonaConfig((prev) => ({
                    ...prev,
                    excludedTopics: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="쉼표로 구분: 경쟁사, 가격 협상"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                챗봇이 응답하지 않을 주제들
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
