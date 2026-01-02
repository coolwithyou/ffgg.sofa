'use client';

import Link from 'next/link';
import { useCurrentChatbot } from '../hooks/use-console-state';
import { useAutoSave } from '../hooks/use-auto-save';
import { SaveStatusIndicator } from './save-status-indicator';
import { ChatbotSwitcher } from './chatbot-switcher';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ExternalLink, Rocket, Command, Sofa } from 'lucide-react';

/**
 * Console Top Bar
 *
 * 전체 Console 상단에 고정되는 바
 *
 * 좌측: 챗봇 선택기 (프로젝트 컨텍스트)
 * 중앙: 저장 상태
 * 우측: 미리보기 링크 + 발행 버튼
 */
export function ConsoleTopBar() {
  const { currentChatbot } = useCurrentChatbot();
  const { saveStatus, saveNow } = useAutoSave();
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
      {/* 좌측: 로고 + 챗봇 선택기 */}
      <div className="flex items-center gap-4">
        {/* 로고 */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-primary"
        >
          <Sofa className="h-5 w-5" />
          <span className="hidden sm:inline">SOFA</span>
        </Link>

        {/* 구분선 */}
        <div className="h-6 w-px bg-border" />

        {/* 챗봇 선택기 */}
        <ChatbotSwitcher />
      </div>

      {/* 중앙: 저장 상태 */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <SaveStatusIndicator />
      </div>

      {/* 우측: 액션 버튼들 */}
      <div className="flex items-center gap-2">
        {/* Command Palette 버튼 (향후 구현) */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden items-center gap-1.5 text-muted-foreground sm:flex"
        >
          <Command className="h-3.5 w-3.5" />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </Button>

        {/* 미리보기 링크 */}
        {currentChatbot?.slug && currentChatbot.publicPageEnabled && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/${currentChatbot.slug}`}
              target="_blank"
              className="flex items-center gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">미리보기</span>
            </Link>
          </Button>
        )}

        {/* 발행 버튼 */}
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-1.5"
        >
          <Rocket className="h-4 w-4" />
          <span className="hidden sm:inline">발행하기</span>
        </Button>
      </div>
    </header>
  );
}
