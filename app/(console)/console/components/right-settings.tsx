'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useConsole, useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';
import { useAutoSave } from '../hooks/use-auto-save';
import { useBlocks } from '../hooks/use-blocks';
import { HeaderSettings } from './settings/header-settings';
import { ThemeSettings } from './settings/theme-settings';
import { SeoSettings } from './settings/seo-settings';
import { ChatbotSettings } from './settings/chatbot-settings';
import { BlockPalette } from '../appearance/components/block-editor/block-palette';
import { BlockSettingsPanel } from '../appearance/components/block-editor/block-settings-panel';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Palette,
  Search,
  MessageSquare,
  ExternalLink,
  Rocket,
  LayoutGrid,
  Settings,
} from 'lucide-react';

/**
 * 우측 설정 패널
 *
 * 아코디언 UI로 섹션별 설정을 관리합니다:
 * - 헤더 설정: 제목, 설명, 로고, 브랜드명 표시
 * - 챗봇 설정: 채팅 영역 최소/최대 높이
 * - 테마 설정: 배경색, 주요색, 텍스트색, 폰트
 * - SEO 설정: 페이지 타이틀, 메타 설명, OG 이미지
 *
 * 기본 상태:
 * - 헤더, 테마: 펼쳐진 상태 (자주 사용)
 * - 챗봇, SEO: 접힌 상태 (덜 자주 사용)
 */
export function RightSettings() {
  const { mode } = useConsoleMode();
  const { currentChatbot } = useCurrentChatbot();
  const { saveStatus, saveNow } = useAutoSave();
  const { success, error: showError } = useToast();
  const { reloadChatbots } = useConsole();

  // 발행 핸들러
  const handlePublish = async () => {
    if (!currentChatbot) return;

    // 저장 중이면 완료될 때까지 대기
    if (saveStatus === 'saving') {
      await saveNow();
    }

    // 이미 공개된 상태면 페이지로 이동
    if (currentChatbot.publicPageEnabled) {
      window.open(`/${currentChatbot.slug}`, '_blank');
      return;
    }

    try {
      // POST /api/chatbots/:id/public-page 호출하여 활성화
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/public-page`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '발행에 실패했습니다');
      }

      // 챗봇 목록 새로고침
      await reloadChatbots();

      success('발행 완료', `${currentChatbot.name} 페이지가 공개되었습니다.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '발행 중 오류가 발생했습니다';
      showError('발행 실패', message);
    }
  };

  if (!currentChatbot) {
    return (
      <aside className="flex w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </aside>
    );
  }

  // Widget 모드는 Phase 6에서 구현
  if (mode === 'widget') {
    return (
      <aside className="w-80 border-l border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground">위젯 설정</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          위젯 설정은 Phase 6에서 구현됩니다.
        </p>
      </aside>
    );
  }

  // 블록 관리 훅
  const { blocks, addBlock, selectedBlockId, selectBlock, updateBlock } = useBlocks();

  // 선택된 블록 찾기
  const selectedBlock = useMemo(() => {
    if (!selectedBlockId) return null;
    return blocks.find((b) => b.id === selectedBlockId) ?? null;
  }, [blocks, selectedBlockId]);

  return (
    <aside className="flex w-80 flex-col overflow-hidden border-l border-border bg-card">
      {/* 헤더 */}
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground">페이지 설정</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentChatbot.name}의 공개 페이지를 커스터마이징하세요.
        </p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 border-b border-border p-4">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link href={`/${currentChatbot.slug}`} target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            미리보기
          </Link>
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handlePublish}
          disabled={saveStatus === 'saving'}
        >
          <Rocket className="mr-2 h-4 w-4" />
          {currentChatbot.publicPageEnabled ? '공개됨' : '발행하기'}
        </Button>
      </div>

      {/* 탭: 블록 / 설정 */}
      <Tabs defaultValue="blocks" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-4 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="blocks" className="flex-1 gap-2">
              <LayoutGrid className="h-4 w-4" />
              블록
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-2">
              <Settings className="h-4 w-4" />
              설정
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 블록 탭 */}
        <TabsContent value="blocks" className="flex-1 overflow-y-auto p-4 mt-0">
          {/* 선택된 블록 설정 패널 */}
          {selectedBlock && (
            <>
              <BlockSettingsPanel
                selectedBlock={selectedBlock}
                onUpdate={(updates) => updateBlock(selectedBlock.id, updates)}
                onClose={() => selectBlock(null)}
              />
              <Separator className="my-4" />
            </>
          )}

          {/* 블록 팔레트 */}
          <BlockPalette blocks={blocks} onAddBlock={addBlock} />
        </TabsContent>

        {/* 설정 탭 */}
        <TabsContent value="settings" className="flex-1 overflow-y-auto mt-0">
          <Accordion
            type="multiple"
            defaultValue={['header', 'theme']}
            className="p-4"
          >
            {/* 헤더 설정 */}
            <AccordionItem value="header" className="border-border">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  헤더 설정
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <HeaderSettings />
              </AccordionContent>
            </AccordionItem>

            {/* 챗봇 설정 */}
            <AccordionItem value="chatbot" className="border-border">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  챗봇 설정
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ChatbotSettings />
              </AccordionContent>
            </AccordionItem>

            {/* 테마 설정 */}
            <AccordionItem value="theme" className="border-border">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  테마 설정
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ThemeSettings />
              </AccordionContent>
            </AccordionItem>

            {/* SEO 설정 */}
            <AccordionItem value="seo" className="border-border">
              <AccordionTrigger className="hover:no-underline">
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  SEO 설정
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <SeoSettings />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
