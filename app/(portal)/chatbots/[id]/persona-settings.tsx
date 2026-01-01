/**
 * 페르소나 설정 컴포넌트
 * Intent-Aware RAG 시스템용 챗봇 페르소나 관리
 */

'use client';

import { useState, useEffect } from 'react';
import { User, Check, RotateCcw, Sparkles, Plus, X } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';

interface PersonaConfig {
  name?: string;
  expertiseArea?: string;
  expertiseDescription?: string;
  includedTopics?: string[];
  excludedTopics?: string[];
  tone?: 'professional' | 'friendly' | 'casual';
}

interface PersonaSettingsProps {
  chatbotId: string;
  onUpdate: () => void;
}

const DEFAULT_PERSONA: PersonaConfig = {
  name: 'AI 어시스턴트',
  expertiseArea: '기업 문서 및 FAQ',
  expertiseDescription: '',
  includedTopics: [],
  excludedTopics: [],
  tone: 'friendly',
};

const TONE_OPTIONS = [
  { value: 'professional', label: '전문적', description: '격식있고 정중한 어조' },
  { value: 'friendly', label: '친근함', description: '따뜻하고 친근한 어조 (기본값)' },
  { value: 'casual', label: '캐주얼', description: '편안하고 가벼운 어조' },
] as const;

export function PersonaSettings({ chatbotId, onUpdate }: PersonaSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { confirm } = useAlertDialog();
  const { success, error: showError } = useToast();

  // 페르소나 상태
  const [name, setName] = useState(DEFAULT_PERSONA.name!);
  const [expertiseArea, setExpertiseArea] = useState(DEFAULT_PERSONA.expertiseArea!);
  const [expertiseDescription, setExpertiseDescription] = useState(DEFAULT_PERSONA.expertiseDescription || '');
  const [includedTopics, setIncludedTopics] = useState<string[]>(DEFAULT_PERSONA.includedTopics || []);
  const [excludedTopics, setExcludedTopics] = useState<string[]>(DEFAULT_PERSONA.excludedTopics || []);
  const [tone, setTone] = useState<'professional' | 'friendly' | 'casual'>(DEFAULT_PERSONA.tone!);

  // 토픽 입력 상태
  const [newIncludedTopic, setNewIncludedTopic] = useState('');
  const [newExcludedTopic, setNewExcludedTopic] = useState('');

  // AI 생성 결과
  const [generatedKeywords, setGeneratedKeywords] = useState<string[]>([]);
  const [generatedConfidence, setGeneratedConfidence] = useState<number | null>(null);

  useEffect(() => {
    fetchPersona();
  }, [chatbotId]);

  const fetchPersona = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chatbots/${chatbotId}/persona`);
      if (response.ok) {
        const data = await response.json();
        if (data.personaConfig) {
          setName(data.personaConfig.name || DEFAULT_PERSONA.name!);
          setExpertiseArea(data.personaConfig.expertiseArea || DEFAULT_PERSONA.expertiseArea!);
          setExpertiseDescription(data.personaConfig.expertiseDescription || '');
          setIncludedTopics(data.personaConfig.includedTopics || []);
          setExcludedTopics(data.personaConfig.excludedTopics || []);
          setTone(data.personaConfig.tone || DEFAULT_PERSONA.tone!);
        }
      }
    } catch (err) {
      console.error('Persona fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/persona`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          expertiseArea,
          expertiseDescription,
          includedTopics,
          excludedTopics,
          tone,
        }),
      });

      if (response.ok) {
        onUpdate();
        success('저장 완료', '페르소나 설정이 저장되었습니다');
      } else {
        const data = await response.json();
        showError('저장 실패', data.error || '저장에 실패했습니다');
      }
    } catch (err) {
      console.error('Save error:', err);
      showError('저장 실패', '저장 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: '설정 초기화',
      message: '페르소나 설정을 기본값으로 초기화하시겠습니까?',
      confirmText: '초기화',
      cancelText: '취소',
    });

    if (!confirmed) return;

    setName(DEFAULT_PERSONA.name!);
    setExpertiseArea(DEFAULT_PERSONA.expertiseArea!);
    setExpertiseDescription('');
    setIncludedTopics([]);
    setExcludedTopics([]);
    setTone(DEFAULT_PERSONA.tone!);
    setNewIncludedTopic('');
    setNewExcludedTopic('');
    setGeneratedKeywords([]);
    setGeneratedConfidence(null);
  };

  // 토픽 추가/삭제 핸들러
  const handleAddIncludedTopic = () => {
    const topic = newIncludedTopic.trim();
    if (topic && !includedTopics.includes(topic) && includedTopics.length < 20) {
      setIncludedTopics([...includedTopics, topic]);
      setNewIncludedTopic('');
    }
  };

  const handleRemoveIncludedTopic = (topic: string) => {
    setIncludedTopics(includedTopics.filter((t) => t !== topic));
  };

  const handleAddExcludedTopic = () => {
    const topic = newExcludedTopic.trim();
    if (topic && !excludedTopics.includes(topic) && excludedTopics.length < 20) {
      setExcludedTopics([...excludedTopics, topic]);
      setNewExcludedTopic('');
    }
  };

  const handleRemoveExcludedTopic = (topic: string) => {
    setExcludedTopics(excludedTopics.filter((t) => t !== topic));
  };

  const handleGeneratePersona = async () => {
    setIsGenerating(true);
    setGeneratedKeywords([]);
    setGeneratedConfidence(null);

    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/generate-persona`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.persona) {
        // AI 생성 결과를 폼에 적용
        setExpertiseArea(data.persona.expertiseArea || '');
        setExpertiseDescription(data.persona.expertiseDescription || '');
        setIncludedTopics(data.persona.includedTopics || []);
        setExcludedTopics(data.persona.excludedTopics || []);
        setTone(data.persona.tone || 'friendly');
        setGeneratedKeywords(data.persona.keywords || []);
        setGeneratedConfidence(data.persona.confidence || null);
      } else {
        showError('생성 실패', data.error || '페르소나 생성에 실패했습니다');
      }
    } catch (err) {
      console.error('Generate error:', err);
      showError('생성 실패', '페르소나 생성 중 오류가 발생했습니다');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페르소나 설정 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <User className="h-5 w-5" />
          페르소나 설정
        </h3>
        <div className="space-y-4">
          {/* 챗봇 이름 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              챗봇 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="AI 어시스턴트"
              maxLength={50}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              사용자에게 표시되는 챗봇의 이름입니다.
            </p>
          </div>

          {/* 전문 분야 (간략) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              전문 분야 (요약)
            </label>
            <input
              type="text"
              value={expertiseArea}
              onChange={(e) => setExpertiseArea(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="예: 도장 제품 및 시공 관련 FAQ"
              maxLength={100}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              챗봇의 전문 분야를 한 줄로 요약합니다 (최대 100자).
            </p>
          </div>

          {/* 전문 분야 상세 설명 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              전문 분야 상세 설명
            </label>
            <textarea
              value={expertiseDescription}
              onChange={(e) => setExpertiseDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="예: 이 챗봇은 페인트, 도료, 오일스테인 등 도장 제품에 대한 FAQ를 담당합니다. 제품 선택, 시공 방법, 유지보수, A/S 정책 등에 대해 답변할 수 있습니다. 색상 추천, 면적당 소요량 계산, 건조 시간 등 실용적인 정보도 제공합니다."
              rows={4}
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              AI가 RAG 접근 여부를 판단할 때 참고하는 상세 설명입니다 (최대 1000자).
            </p>
          </div>

          {/* 포함 주제 (DOMAIN_QUERY로 분류) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              포함 주제
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (이 키워드가 포함된 질문은 RAG 검색 대상)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newIncludedTopic}
                onChange={(e) => setNewIncludedTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIncludedTopic();
                  }
                }}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="예: 페인트, 시공, A/S"
                maxLength={50}
              />
              <button
                type="button"
                onClick={handleAddIncludedTopic}
                disabled={!newIncludedTopic.trim() || includedTopics.length >= 20}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                추가
              </button>
            </div>
            {includedTopics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {includedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs text-green-600 dark:text-green-400"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => handleRemoveIncludedTopic(topic)}
                      className="rounded-full p-0.5 hover:bg-green-500/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              최대 20개까지 추가 가능. Enter 또는 추가 버튼으로 입력.
            </p>
          </div>

          {/* 제외 주제 (OUT_OF_SCOPE로 분류) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              제외 주제
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (이 키워드가 포함된 질문은 범위 외로 거절)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newExcludedTopic}
                onChange={(e) => setNewExcludedTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddExcludedTopic();
                  }
                }}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="예: 주식, 코딩, 날씨"
                maxLength={50}
              />
              <button
                type="button"
                onClick={handleAddExcludedTopic}
                disabled={!newExcludedTopic.trim() || excludedTopics.length >= 20}
                className="flex items-center gap-1 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                추가
              </button>
            </div>
            {excludedTopics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {excludedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => handleRemoveExcludedTopic(topic)}
                      className="rounded-full p-0.5 hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              최대 20개까지 추가 가능. 이 주제의 질문에는 &quot;전문 분야가 아니에요&quot;라고 거절합니다.
            </p>
          </div>

          {/* 대화 어조 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              대화 어조
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TONE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                    tone === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tone"
                    value={option.value}
                    checked={tone === option.value}
                    onChange={() => setTone(option.value)}
                    className="sr-only"
                  />
                  <div className="text-sm font-medium text-foreground">
                    {option.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {option.description}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI 자동 생성 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <Sparkles className="h-5 w-5" />
          AI 자동 생성
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          연결된 데이터셋의 문서를 분석하여 전문 분야를 자동으로 추출합니다.
        </p>
        <button
          onClick={handleGeneratePersona}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              문서 분석 중...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              AI로 자동 생성
            </>
          )}
        </button>

        {/* AI 생성 결과 표시 */}
        {generatedKeywords.length > 0 && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <h4 className="text-sm font-medium text-foreground">AI 분석 결과</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {generatedKeywords.map((keyword, index) => (
                <span
                  key={index}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  {keyword}
                </span>
              ))}
            </div>
            {generatedConfidence !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                분석 신뢰도: {(generatedConfidence * 100).toFixed(0)}%
              </p>
            )}
          </div>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              저장 중...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              설정 저장
            </>
          )}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <RotateCcw className="h-4 w-4" />
          기본값으로 초기화
        </button>
      </div>

      {/* 안내 */}
      <div className="rounded-lg bg-muted/50 p-4">
        <h4 className="text-sm font-medium text-foreground">페르소나 설정 안내</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>
            • <strong>챗봇 이름</strong>: 사용자와의 대화에서 자신을 소개할 때 사용됩니다.
          </li>
          <li>
            • <strong>전문 분야 (요약)</strong>: 챗봇의 전문성을 한 줄로 요약한 설명입니다.
          </li>
          <li>
            • <strong>전문 분야 상세 설명</strong>: AI가 질문을 분류할 때 참고합니다. 구체적일수록 정확한 분류가 가능합니다.
          </li>
          <li>
            • <strong className="text-green-600 dark:text-green-400">포함 주제</strong>: 이 키워드가 포함된 질문은 RAG 검색을 통해 답변합니다.
          </li>
          <li>
            • <strong className="text-destructive">제외 주제</strong>: 이 키워드가 포함된 질문은 &quot;전문 분야가 아니에요&quot;라고 거절합니다.
          </li>
          <li>
            • <strong>대화 어조</strong>: 응답의 전반적인 톤을 결정합니다.
          </li>
          <li>
            • <strong>AI 자동 생성</strong>: 데이터셋에 문서가 있어야 분석이 가능합니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
