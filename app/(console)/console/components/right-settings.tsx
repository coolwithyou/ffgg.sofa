'use client';

import { useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';
import { HeaderSettings } from './settings/header-settings';
import { ThemeSettings } from './settings/theme-settings';
import { SeoSettings } from './settings/seo-settings';
import { ChatbotSettings } from './settings/chatbot-settings';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FileText, Palette, Search, MessageSquare } from 'lucide-react';

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

  return (
    <aside className="w-80 overflow-y-auto border-l border-border bg-card">
      {/* 헤더 */}
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground">페이지 설정</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentChatbot.name}의 공개 페이지를 커스터마이징하세요.
        </p>
      </div>

      {/* 설정 아코디언 */}
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
    </aside>
  );
}
