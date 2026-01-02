'use client';

import { useState } from 'react';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Copy, Check, AlertCircle } from 'lucide-react';

/**
 * 위젯 임베드 코드 설정
 *
 * - Script 태그 / iframe 탭
 * - 복사 버튼
 * - 위젯 미활성화 시 안내 메시지
 */
export function WidgetEmbedSettings() {
  const { currentChatbot } = useCurrentChatbot();
  const { success } = useToast();
  const [copiedTab, setCopiedTab] = useState<'script' | 'iframe' | null>(null);

  const isEnabled = currentChatbot?.widgetEnabled ?? false;
  const apiKey = currentChatbot?.widgetApiKey ?? '';
  const tenantId = currentChatbot?.tenantId ?? '';

  // 기본 URL (환경에 따라 변경 필요)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Script 임베드 코드
  const scriptCode = `<script src="${baseUrl}/widget.js" data-tenant-id="${tenantId}" data-api-key="${apiKey}" async></script>`;

  // iframe 임베드 코드
  const iframeCode = `<iframe src="${baseUrl}/widget/${tenantId}?apiKey=${apiKey}" style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999;" allow="microphone"></iframe>`;

  const handleCopy = async (code: string, tab: 'script' | 'iframe') => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedTab(tab);
      success('클립보드에 복사되었습니다!');
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedTab(tab);
      success('클립보드에 복사되었습니다!');
      setTimeout(() => setCopiedTab(null), 2000);
    }
  };

  // 위젯 미활성화 상태
  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">위젯이 비활성화되어 있습니다</p>
          <p className="mt-1 text-sm text-muted-foreground">
            위젯을 활성화하면 임베드 코드를 확인할 수 있습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <Tabs defaultValue="script" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="script">Script 태그</TabsTrigger>
          <TabsTrigger value="iframe">iframe</TabsTrigger>
        </TabsList>

        {/* Script 태그 */}
        <TabsContent value="script" className="mt-3">
          <div className="space-y-2">
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                <code className="text-foreground">{scriptCode}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2"
                onClick={() => handleCopy(scriptCode, 'script')}
              >
                {copiedTab === 'script' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              이 코드를 웹사이트의 {'<body>'} 태그 끝에 붙여넣으세요.
              위젯이 자동으로 표시됩니다.
            </p>
          </div>
        </TabsContent>

        {/* iframe */}
        <TabsContent value="iframe" className="mt-3">
          <div className="space-y-2">
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                <code className="text-foreground">{iframeCode}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2"
                onClick={() => handleCopy(iframeCode, 'iframe')}
              >
                {copiedTab === 'iframe' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              위젯을 iframe으로 삽입합니다.
              위치와 크기는 필요에 따라 조정하세요.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* API Key 표시 */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium text-foreground">API Key</p>
        <code className="mt-1 block text-xs text-muted-foreground">
          {apiKey || '(생성 대기 중)'}
        </code>
      </div>
    </div>
  );
}
