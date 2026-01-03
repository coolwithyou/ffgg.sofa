'use client';

import Link from 'next/link';
import { useCurrentChatbot } from '../hooks/use-console-state';
import { useAutoSaveContext } from '../hooks/use-auto-save';
import { SaveStatusIndicator } from './save-status-indicator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ExternalLink, Rocket } from 'lucide-react';

/**
 * 콘솔 헤더
 *
 * 좌측: 로고
 * 중앙: 저장 상태
 * 우측: 미리보기 링크 + 발행 버튼
 */
export function ConsoleHeader() {
  const { currentChatbot } = useCurrentChatbot();
  const { saveStatus, saveNow } = useAutoSaveContext();
  const toast = useToast();

  const handlePublish = async () => {
    if (!currentChatbot) return;

    // 저장되지 않은 변경사항이 있으면 먼저 저장
    if (saveStatus === 'unsaved') {
      saveNow();
    }

    try {
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/public-page/publish`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('발행에 실패했습니다');
      }

      toast.success('발행 완료', '변경사항이 공개 페이지에 적용되었습니다.');
    } catch (error) {
      toast.error('발행 실패', '잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-4">
        <Link href="/" className="text-xl font-bold text-primary">
          SOFA
        </Link>
        <span className="text-sm text-muted-foreground">Console Editor</span>
      </div>

      {/* 중앙: 저장 상태 */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <SaveStatusIndicator />
      </div>

      {/* 우측: 미리보기 + 발행 */}
      <div className="flex items-center gap-3">
        {currentChatbot?.slug && currentChatbot.publicPageEnabled && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/${currentChatbot.slug}`}
              target="_blank"
              className="flex items-center gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              미리보기
            </Link>
          </Button>
        )}

        <Button
          size="sm"
          onClick={handlePublish}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-1.5"
        >
          <Rocket className="h-4 w-4" />
          발행하기
        </Button>
      </div>
    </header>
  );
}
