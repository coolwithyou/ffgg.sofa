'use client';

import { useMemo } from 'react';
import { useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';
import { useBlocks } from '../hooks/use-blocks';
import { type Block } from '@/lib/public-page/block-types';
import { HeaderSettings } from './settings/header-settings';
import { ThemeSettings } from './settings/theme-settings';
import { SeoSettings } from './settings/seo-settings';
import { ChatbotSettings } from './settings/chatbot-settings';
import { PublishStatusCard } from './publish-status-card';
import { BlockPalette } from '../page/components/block-editor/block-palette';
import { BlockSettingsPanel } from '../page/components/block-editor/block-settings-panel';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Palette,
  Search,
  MessageSquare,
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

  if (!currentChatbot) {
    return (
      <aside className="flex w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </aside>
    );
  }

  // Widget 모드
  if (mode === 'widget') {
    return (
      <aside className="flex w-80 flex-col overflow-hidden border-l border-border bg-card">
        {/* 헤더 */}
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">위젯 설정</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentChatbot.name}의 임베드 위젯을 커스터마이징하세요.
          </p>
        </div>

        {/* 발행 상태 카드 */}
        <div className="border-b border-border p-4">
          <PublishStatusCard mode="widget" />
        </div>

        {/* 추가 위젯 설정은 Phase 6에서 구현 */}
        <div className="flex-1 p-4">
          <p className="text-sm text-muted-foreground">
            위젯 상세 설정은 추후 업데이트됩니다.
          </p>
        </div>
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

      {/* 발행 상태 카드 */}
      <div className="border-b border-border p-4">
        <PublishStatusCard mode="public-page" />
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
                onUpdate={(updates: Partial<Block>) => updateBlock(selectedBlock.id, updates)}
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
