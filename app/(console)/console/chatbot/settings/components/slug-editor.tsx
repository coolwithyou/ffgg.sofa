'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Check,
  X,
  Loader2,
  Pencil,
  Crown,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Tier } from '@/lib/tier/constants';

interface SlugChangeLimitInfo {
  canChange: boolean;
  remaining: number; // -1은 무제한
  limit: number; // -1은 무제한
  reason?: string;
}

interface SlugEditorProps {
  chatbotId: string;
  currentSlug: string | null;
  onSlugChange?: (newSlug: string) => void;
}

type CheckStatus = 'idle' | 'checking' | 'available' | 'unavailable';

/**
 * SlugEditor - 슬러그 편집 컴포넌트
 *
 * 기능:
 * - 실시간 중복/예약어 검사 (디바운스 500ms)
 * - 티어별 변경 제한 표시
 * - free 티어: 업그레이드 안내
 * - pro 티어: 남은 변경 횟수 표시
 * - business 티어: 무제한
 */
export function SlugEditor({
  chatbotId,
  currentSlug,
  onSlugChange,
}: SlugEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentSlug || '');
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 슬러그 변경 제한 정보
  const [limitInfo, setLimitInfo] = useState<SlugChangeLimitInfo | null>(null);
  const [tier, setTier] = useState<Tier>('free');
  const [isLoadingLimit, setIsLoadingLimit] = useState(true);

  // 슬러그 변경 제한 정보 로드
  useEffect(() => {
    const fetchLimitInfo = async () => {
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/slug`);
        if (res.ok) {
          const data = await res.json();
          setLimitInfo(data.changeLimit);
          setTier(data.tier);
        }
      } catch (err) {
        console.error('Failed to fetch slug limit info:', err);
      } finally {
        setIsLoadingLimit(false);
      }
    };

    fetchLimitInfo();
  }, [chatbotId]);

  // 슬러그 중복/예약어 검사 (디바운스)
  const checkSlugAvailability = useDebouncedCallback(
    async (slug: string) => {
      if (!slug || slug === currentSlug) {
        setCheckStatus('idle');
        setError(null);
        return;
      }

      // 기본 형식 검사
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        setCheckStatus('unavailable');
        setError('영문 소문자, 숫자, 하이픈만 사용 가능합니다');
        return;
      }

      if (slug.length < 3) {
        setCheckStatus('unavailable');
        setError('3자 이상 입력해주세요');
        return;
      }

      setCheckStatus('checking');
      setError(null);

      try {
        const res = await fetch(
          `/api/chatbots/check-slug?slug=${encodeURIComponent(slug)}&excludeId=${chatbotId}`
        );
        const data = await res.json();

        if (data.valid && data.available) {
          setCheckStatus('available');
          setError(null);
        } else {
          setCheckStatus('unavailable');
          setError(data.error || '사용할 수 없는 키워드입니다');
        }
      } catch (err) {
        console.error('Slug check error:', err);
        setCheckStatus('idle');
        setError('확인 중 오류가 발생했습니다');
      }
    },
    500
  );

  // 입력 값 변경 핸들러
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setInputValue(value);
      setError(null);
      checkSlugAvailability(value);
    },
    [checkSlugAvailability]
  );

  // 편집 취소
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setInputValue(currentSlug || '');
    setCheckStatus('idle');
    setError(null);
  }, [currentSlug]);

  // 슬러그 저장
  const handleSave = useCallback(async () => {
    if (!inputValue || checkStatus !== 'available') return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/slug`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: inputValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '슬러그 변경에 실패했습니다');
      }

      // 제한 정보 업데이트
      if (data.changeLimit) {
        setLimitInfo(data.changeLimit);
      }

      setIsEditing(false);
      setCheckStatus('idle');
      toast.success('슬러그가 변경되었습니다');
      onSlugChange?.(inputValue);
    } catch (err) {
      const message = err instanceof Error ? err.message : '슬러그 변경에 실패했습니다';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [chatbotId, inputValue, checkStatus, onSlugChange]);

  // 편집 모드 시작
  const startEditing = useCallback(() => {
    if (limitInfo && !limitInfo.canChange) {
      toast.error(limitInfo.reason || '슬러그를 변경할 수 없습니다');
      return;
    }
    setInputValue(currentSlug || '');
    setIsEditing(true);
    setCheckStatus('idle');
    setError(null);
  }, [currentSlug, limitInfo]);

  // 상태 아이콘 렌더링
  const renderStatusIcon = () => {
    switch (checkStatus) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'available':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'unavailable':
        return <X className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  // 남은 변경 횟수 텍스트
  const renderLimitText = () => {
    if (isLoadingLimit || !limitInfo) return null;

    if (tier === 'free') {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Crown className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground">
            Pro 플랜으로 업그레이드하면 슬러그를 변경할 수 있습니다
          </span>
        </div>
      );
    }

    if (limitInfo.limit === -1) {
      // business: 무제한
      return null;
    }

    // pro: 남은 횟수 표시
    return (
      <p className="text-xs text-muted-foreground">
        오늘 남은 변경 횟수: {limitInfo.remaining}/{limitInfo.limit}회
      </p>
    );
  };

  // 로딩 중
  if (isLoadingLimit) {
    return (
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">로딩 중...</span>
        </div>
      </div>
    );
  }

  // 슬러그 없음 + free 티어
  if (!currentSlug && tier === 'free') {
    return (
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Crown className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground">
            Pro 플랜으로 업그레이드하면 공개 페이지를 사용할 수 있습니다
          </span>
        </div>
      </div>
    );
  }

  // 편집 모드
  if (isEditing) {
    return (
      <div className="space-y-3 rounded-lg bg-muted/50 p-3">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">공개 페이지 주소</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {typeof window !== 'undefined' ? window.location.origin : ''}/
            </span>
            <div className="relative flex-1">
              <Input
                value={inputValue}
                onChange={handleInputChange}
                placeholder="my-chatbot"
                className="pr-8"
                autoFocus
                disabled={isSaving}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {renderStatusIcon()}
              </div>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          {renderLimitText()}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                isSaving ||
                checkStatus !== 'available' ||
                inputValue === currentSlug
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 표시 모드
  return (
    <div className="space-y-2 rounded-lg bg-muted/50 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">공개 페이지 주소</p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {typeof window !== 'undefined' ? window.location.origin : ''}/
            {currentSlug || <span className="text-muted-foreground">(미설정)</span>}
          </p>
        </div>
        {limitInfo?.canChange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startEditing}
            className="h-8 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            변경
          </Button>
        )}
      </div>
      {renderLimitText()}
    </div>
  );
}
