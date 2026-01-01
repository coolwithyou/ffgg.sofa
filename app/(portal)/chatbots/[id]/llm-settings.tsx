/**
 * LLM 및 검색 설정 컴포넌트
 */

'use client';

import { useState } from 'react';
import { Settings, Sparkles, Search, Check, RotateCcw } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';

interface LlmConfig {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string | null;
}

interface SearchConfig {
  maxChunks?: number;
  minScore?: number;
}

interface LlmSettingsProps {
  chatbotId: string;
  llmConfig: LlmConfig;
  searchConfig: SearchConfig;
  onUpdate: () => void;
}

const DEFAULT_LLM_CONFIG = {
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: null,
};

const DEFAULT_SEARCH_CONFIG = {
  maxChunks: 5,
  minScore: 0.5,
};

export function LlmSettings({
  chatbotId,
  llmConfig,
  searchConfig,
  onUpdate,
}: LlmSettingsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { confirm } = useAlertDialog();
  const { success } = useToast();

  // LLM 설정 상태
  const [temperature, setTemperature] = useState(
    llmConfig.temperature ?? DEFAULT_LLM_CONFIG.temperature
  );
  const [maxTokens, setMaxTokens] = useState(
    llmConfig.maxTokens ?? DEFAULT_LLM_CONFIG.maxTokens
  );
  const [systemPrompt, setSystemPrompt] = useState(
    llmConfig.systemPrompt ?? ''
  );

  // 검색 설정 상태
  const [maxChunks, setMaxChunks] = useState(
    searchConfig.maxChunks ?? DEFAULT_SEARCH_CONFIG.maxChunks
  );
  const [minScore, setMinScore] = useState(
    searchConfig.minScore ?? DEFAULT_SEARCH_CONFIG.minScore
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmConfig: {
            temperature,
            maxTokens,
            systemPrompt: systemPrompt || null,
          },
          searchConfig: {
            maxChunks,
            minScore,
          },
        }),
      });

      if (response.ok) {
        onUpdate();
        success('저장 완료', '설정이 저장되었습니다');
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: '설정 초기화',
      message: '설정을 기본값으로 초기화하시겠습니까?',
      confirmText: '초기화',
      cancelText: '취소',
    });

    if (!confirmed) return;

    setTemperature(DEFAULT_LLM_CONFIG.temperature);
    setMaxTokens(DEFAULT_LLM_CONFIG.maxTokens);
    setSystemPrompt('');
    setMaxChunks(DEFAULT_SEARCH_CONFIG.maxChunks);
    setMinScore(DEFAULT_SEARCH_CONFIG.minScore);
  };

  return (
    <div className="space-y-6">
      {/* LLM 설정 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <Sparkles className="h-5 w-5" />
          LLM 설정
        </h3>
        <div className="space-y-4">
          {/* Temperature */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Temperature
              </label>
              <span className="text-sm text-muted-foreground">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>정확함 (0)</span>
              <span>창의적 (2)</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              낮을수록 일관된 답변, 높을수록 다양한 답변을 생성합니다.
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                최대 토큰 수
              </label>
              <span className="text-sm text-muted-foreground">{maxTokens}</span>
            </div>
            <input
              type="range"
              min="100"
              max="4096"
              step="100"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>짧음 (100)</span>
              <span>길음 (4096)</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              답변의 최대 길이를 제한합니다. 더 긴 답변이 필요하면 늘려주세요.
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              시스템 프롬프트 (선택사항)
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="챗봇의 성격이나 응답 스타일을 정의하세요..."
              rows={4}
              maxLength={2000}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              챗봇의 성격, 응답 스타일, 제약 조건 등을 정의할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 검색 설정 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <Search className="h-5 w-5" />
          검색 설정
        </h3>
        <div className="space-y-4">
          {/* Max Chunks */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                최대 청크 수
              </label>
              <span className="text-sm text-muted-foreground">{maxChunks}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={maxChunks}
              onChange={(e) => setMaxChunks(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>1개</span>
              <span>20개</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              답변 생성에 사용할 최대 문서 청크 수입니다. 많을수록 정확하지만
              비용이 증가합니다.
            </p>
          </div>

          {/* Min Score */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                최소 유사도 점수
              </label>
              <span className="text-sm text-muted-foreground">
                {minScore.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minScore}
              onChange={(e) => setMinScore(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>관대함 (0)</span>
              <span>엄격함 (1)</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              이 점수 이상의 유사도를 가진 청크만 사용합니다. 높을수록 관련성 높은
              문서만 사용합니다.
            </p>
          </div>
        </div>
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
        <h4 className="text-sm font-medium text-foreground">설정 안내</h4>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>
            • <strong>Temperature</strong>: 높은 값은 더 창의적이지만 덜 정확할 수
            있습니다.
          </li>
          <li>
            • <strong>최대 토큰</strong>: 긴 답변이 필요하면 늘리세요. 비용에
            영향을 줍니다.
          </li>
          <li>
            • <strong>시스템 프롬프트</strong>: 챗봇의 톤과 제약 조건을 정의합니다.
          </li>
          <li>
            • <strong>최대 청크 수</strong>: 많을수록 정확하지만 응답이 느려질 수
            있습니다.
          </li>
          <li>
            • <strong>최소 유사도</strong>: 낮으면 관련성 낮은 문서도 포함됩니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
