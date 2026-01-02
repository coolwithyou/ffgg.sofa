'use client';

import { useConsole, useCurrentChatbot, useWidgetConfig } from '../hooks/use-console-state';
import { useWidgetAutoSave } from '../hooks/use-widget-auto-save';
import { WidgetAppearanceSettings } from './settings/widget-appearance-settings';
import { WidgetTextSettings } from './settings/widget-text-settings';
import { WidgetPositionSettings } from './settings/widget-position-settings';
import { WidgetEmbedSettings } from './settings/widget-embed-settings';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  Palette,
  Type,
  Move,
  Code,
  ExternalLink,
  Rocket,
} from 'lucide-react';

/**
 * 위젯 설정 패널
 *
 * 아코디언 UI로 섹션별 설정을 관리합니다:
 * - 외관 설정: 색상, 모서리 둥글기, 버튼 크기, 폰트
 * - 텍스트 설정: 제목, 부제목, 환영 메시지, 플레이스홀더
 * - 위치 설정: 위젯 위치, 버튼 아이콘
 * - 임베드 코드: Script 태그 / iframe 코드
 */
export function WidgetSettings() {
  const { currentChatbot } = useCurrentChatbot();
  const { widgetSaveStatus } = useWidgetConfig();
  const { saveNow } = useWidgetAutoSave();
  const { success, error: showError } = useToast();
  const { reloadChatbots } = useConsole();

  // 발행 핸들러
  const handlePublish = async () => {
    if (!currentChatbot) return;

    // 저장 중이면 완료될 때까지 대기
    if (widgetSaveStatus === 'saving') {
      await saveNow();
    }

    // 이미 활성화된 상태면 미리보기 링크 제공
    if (currentChatbot.widgetEnabled) {
      success('위젯이 활성화되어 있습니다. 임베드 코드를 복사해주세요.');
      return;
    }

    try {
      // POST /api/chatbots/:id/widget 호출하여 활성화
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/widget`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '활성화에 실패했습니다');
      }

      // 챗봇 목록 새로고침
      await reloadChatbots();

      success('위젯이 활성화되었습니다!');
    } catch (err) {
      showError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  return (
    <div className="flex h-full w-[360px] flex-col border-l border-border bg-card">
      {/* 상단 액션 */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">위젯 설정</span>
        <Button size="sm" onClick={handlePublish}>
          <Rocket className="mr-1.5 h-4 w-4" />
          {currentChatbot?.widgetEnabled ? '활성화됨' : '활성화'}
        </Button>
      </div>

      {/* 설정 아코디언 */}
      <div className="flex-1 overflow-auto">
        <Accordion
          type="multiple"
          defaultValue={['appearance', 'text']}
          className="px-4"
        >
          {/* 외관 설정 */}
          <AccordionItem value="appearance">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span>외관</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <WidgetAppearanceSettings />
            </AccordionContent>
          </AccordionItem>

          {/* 텍스트 설정 */}
          <AccordionItem value="text">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <span>텍스트</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <WidgetTextSettings />
            </AccordionContent>
          </AccordionItem>

          {/* 위치 설정 */}
          <AccordionItem value="position">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Move className="h-4 w-4 text-muted-foreground" />
                <span>위치</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <WidgetPositionSettings />
            </AccordionContent>
          </AccordionItem>

          {/* 임베드 코드 */}
          <AccordionItem value="embed">
            <AccordionTrigger className="py-3">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                <span>임베드 코드</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <WidgetEmbedSettings />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
