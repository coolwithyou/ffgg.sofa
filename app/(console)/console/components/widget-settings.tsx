'use client';

import { useState } from 'react';
import {
  useConsole,
  useCurrentChatbot,
  useWidgetConfig,
} from '../hooks/use-console-state';
import { useWidgetAutoSave } from '../hooks/use-widget-auto-save';
import { WidgetAppearanceSettings } from './settings/widget-appearance-settings';
import { WidgetTextSettings } from './settings/widget-text-settings';
import { WidgetPositionSettings } from './settings/widget-position-settings';
import { WidgetEmbedDialog } from './widget-embed-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Palette, Type, Move, Code } from 'lucide-react';

/**
 * 위젯 설정 패널
 *
 * 아코디언 UI로 섹션별 설정을 관리합니다:
 * - 외관 설정: 색상, 모서리 둥글기, 버튼 크기, 폰트
 * - 텍스트 설정: 제목, 부제목, 환영 메시지, 플레이스홀더
 * - 위치 설정: 위젯 위치, 버튼 아이콘
 */
export function WidgetSettings() {
  const { currentChatbot } = useCurrentChatbot();
  const { widgetConfig, widgetSaveStatus } = useWidgetConfig();
  const { saveNow } = useWidgetAutoSave();
  const { success, error: showError } = useToast();
  const { reloadChatbots } = useConsole();

  const [isToggling, setIsToggling] = useState(false);
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false);

  const isEnabled = currentChatbot?.widgetEnabled ?? false;

  // 위젯 활성화/비활성화 토글
  const handleToggle = async (checked: boolean) => {
    if (!currentChatbot || isToggling) return;

    setIsToggling(true);

    try {
      // 저장 중이면 완료될 때까지 대기
      if (widgetSaveStatus === 'saving') {
        await saveNow();
      }

      // POST /api/chatbots/:id/widget 호출
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/widget`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: checked }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '상태 변경에 실패했습니다');
      }

      // 챗봇 목록 새로고침
      await reloadChatbots();

      success(checked ? '위젯이 활성화되었습니다!' : '위젯이 비활성화되었습니다');
    } catch (err) {
      showError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="flex h-full w-[360px] flex-col border-l border-border bg-card">
      {/* 상단 액션 */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Switch
            id="widget-enabled"
            size="sm"
            checked={isEnabled}
            onCheckedChange={handleToggle}
            disabled={isToggling}
          />
          <Label
            htmlFor="widget-enabled"
            className="cursor-pointer text-sm font-medium text-foreground"
          >
            {isEnabled ? '활성화' : '비활성화'}
          </Label>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEmbedDialogOpen(true)}
          disabled={!isEnabled}
        >
          <Code className="mr-1.5 h-4 w-4" />
          임베드 코드
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
        </Accordion>
      </div>

      {/* 임베드 코드 다이얼로그 */}
      <WidgetEmbedDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        chatbotId={currentChatbot?.id ?? ''}
        chatbotName={currentChatbot?.name ?? ''}
        apiKey={currentChatbot?.widgetApiKey ?? ''}
        tenantId={currentChatbot?.tenantId ?? ''}
      />
    </div>
  );
}
