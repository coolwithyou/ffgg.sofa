'use client';

import { useWidgetConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * 위젯 텍스트 설정
 *
 * - 제목 (50자)
 * - 부제목 (100자)
 * - 환영 메시지 (500자)
 * - 입력창 플레이스홀더 (100자)
 */
export function WidgetTextSettings() {
  const { widgetConfig, updateWidgetConfig } = useWidgetConfig();
  const { title, subtitle, welcomeMessage, placeholder } = widgetConfig;

  return (
    <div className="space-y-4 pb-4">
      {/* 제목 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="widget-title">제목</Label>
          <span className="text-xs text-muted-foreground">
            {title?.length ?? 0}/50
          </span>
        </div>
        <Input
          id="widget-title"
          value={title ?? ''}
          onChange={(e) => updateWidgetConfig({ title: e.target.value })}
          placeholder="도움이 필요하신가요?"
          maxLength={50}
        />
        <p className="text-xs text-muted-foreground">
          채팅창 헤더에 표시됩니다
        </p>
      </div>

      {/* 부제목 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="widget-subtitle">부제목</Label>
          <span className="text-xs text-muted-foreground">
            {subtitle?.length ?? 0}/100
          </span>
        </div>
        <Input
          id="widget-subtitle"
          value={subtitle ?? ''}
          onChange={(e) => updateWidgetConfig({ subtitle: e.target.value })}
          placeholder="무엇이든 물어보세요"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          제목 아래 작은 텍스트로 표시됩니다
        </p>
      </div>

      {/* 환영 메시지 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="widget-welcome">환영 메시지</Label>
          <span className="text-xs text-muted-foreground">
            {welcomeMessage?.length ?? 0}/500
          </span>
        </div>
        <Textarea
          id="widget-welcome"
          value={welcomeMessage ?? ''}
          onChange={(e) => updateWidgetConfig({ welcomeMessage: e.target.value })}
          placeholder="안녕하세요! 무엇을 도와드릴까요?"
          maxLength={500}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          채팅 시작 시 자동으로 표시되는 첫 메시지입니다
        </p>
      </div>

      {/* 입력창 플레이스홀더 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="widget-placeholder">입력창 안내문구</Label>
          <span className="text-xs text-muted-foreground">
            {placeholder?.length ?? 0}/100
          </span>
        </div>
        <Input
          id="widget-placeholder"
          value={placeholder ?? ''}
          onChange={(e) => updateWidgetConfig({ placeholder: e.target.value })}
          placeholder="메시지를 입력하세요..."
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          메시지 입력 전 표시되는 안내 문구입니다
        </p>
      </div>
    </div>
  );
}
