/**
 * 페르소나 설정 컴포넌트
 * Intent-Aware RAG 시스템용 챗봇 페르소나 관리
 */

'use client';

import { useState, useEffect } from 'react';
import { User, Check, RotateCcw, Sparkles } from 'lucide-react';

interface PersonaConfig {
  name?: string;
  expertiseArea?: string;
  tone?: 'professional' | 'friendly' | 'casual';
}

interface PersonaSettingsProps {
  chatbotId: string;
  onUpdate: () => void;
}

const DEFAULT_PERSONA: PersonaConfig = {
  name: 'AI 어시스턴트',
  expertiseArea: '기업 문서 및 FAQ',
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

  // 페르소나 상태
  const [name, setName] = useState(DEFAULT_PERSONA.name!);
  const [expertiseArea, setExpertiseArea] = useState(DEFAULT_PERSONA.expertiseArea!);
  const [tone, setTone] = useState<'professional' | 'friendly' | 'casual'>(DEFAULT_PERSONA.tone!);

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
        body: JSON.stringify({ name, expertiseArea, tone }),
      });

      if (response.ok) {
        onUpdate();
        alert('페르소나 설정이 저장되었습니다');
      } else {
        const data = await response.json();
        alert(data.error || '저장에 실패했습니다');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('저장 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('페르소나 설정을 기본값으로 초기화하시겠습니까?')) return;

    setName(DEFAULT_PERSONA.name!);
    setExpertiseArea(DEFAULT_PERSONA.expertiseArea!);
    setTone(DEFAULT_PERSONA.tone!);
    setGeneratedKeywords([]);
    setGeneratedConfidence(null);
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
        setExpertiseArea(data.persona.expertiseArea);
        setTone(data.persona.tone);
        setGeneratedKeywords(data.persona.keywords || []);
        setGeneratedConfidence(data.persona.confidence || null);
      } else {
        alert(data.error || '페르소나 생성에 실패했습니다');
      }
    } catch (err) {
      console.error('Generate error:', err);
      alert('페르소나 생성 중 오류가 발생했습니다');
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

          {/* 전문 분야 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              전문 분야
            </label>
            <textarea
              value={expertiseArea}
              onChange={(e) => setExpertiseArea(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="예: 페인트, 도료, 오일스테인 등 도장 제품 및 시공 관련 FAQ"
              rows={3}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              이 분야 외의 질문은 &quot;전문 분야가 아니에요&quot;라고 정중히 거절합니다.
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
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>
            • <strong>챗봇 이름</strong>: 사용자와의 대화에서 자신을 소개할 때 사용됩니다.
          </li>
          <li>
            • <strong>전문 분야</strong>: 이 범위를 벗어나는 질문(코딩, 날씨, 주식 등)은 정중히 거절합니다.
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
