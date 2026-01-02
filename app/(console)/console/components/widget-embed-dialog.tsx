'use client';

import { useState, useCallback, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Copy, Check, AlertTriangle } from 'lucide-react';

type EmbedType = 'javascript' | 'iframe' | 'react';

interface WidgetEmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  chatbotName: string;
  apiKey: string;
  tenantId: string;
}

/**
 * 위젯 임베드 코드 다이얼로그
 *
 * JavaScript / iframe / React 코드를 제공하고 복사 기능 지원
 */
export function WidgetEmbedDialog({
  open,
  onOpenChange,
  chatbotId,
  chatbotName,
  apiKey,
  tenantId,
}: WidgetEmbedDialogProps) {
  const [embedType, setEmbedType] = useState<EmbedType>('javascript');
  const [copied, setCopied] = useState(false);
  const { success } = useToast();

  // 복사 상태 리셋
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // 임베드 코드 생성
  const getEmbedCode = useCallback(() => {
    if (!apiKey) return '';

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    switch (embedType) {
      case 'javascript':
        return `<!-- SOFA Chat Widget -->
<script
  src="${baseUrl}/widget.js"
  data-tenant-id="${tenantId}"
  data-api-key="${apiKey}"
  async
></script>`;

      case 'iframe':
        return `<!-- SOFA Chat Widget (iframe) -->
<iframe
  src="${baseUrl}/widget/${tenantId}?apiKey=${apiKey}"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); z-index: 99999;"
  allow="clipboard-write; microphone"
  loading="lazy"
></iframe>`;

      case 'react':
        return `// SOFA Chat Widget (React)
import { useEffect } from 'react';

export function SofaChatWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${baseUrl}/widget.js';
    script.async = true;
    script.setAttribute('data-tenant-id', '${tenantId}');
    script.setAttribute('data-api-key', '${apiKey}');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      // 위젯 요소 정리
      const widget = document.getElementById('sofa-chat-widget');
      const button = document.getElementById('sofa-chat-button');
      widget?.remove();
      button?.remove();
    };
  }, []);

  return null;
}`;

      default:
        return '';
    }
  }, [apiKey, tenantId, embedType]);

  // 복사 핸들러
  const handleCopy = async () => {
    const code = getEmbedCode();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      success('클립보드에 복사되었습니다!');
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      success('클립보드에 복사되었습니다!');
    }
  };

  return (
    <Dialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="임베드 코드"
      description={chatbotName}
      maxWidth="2xl"
    >
      {/* 탭 */}
      <Tabs
          value={embedType}
          onValueChange={(v) => setEmbedType(v as EmbedType)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="iframe">iframe</TabsTrigger>
            <TabsTrigger value="react">React</TabsTrigger>
          </TabsList>

          {/* 코드 블록 - 모든 탭에서 동일 구조 */}
          <div className="mt-4">
            <div className="relative">
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-4 text-sm">
                <code className="text-foreground">{getEmbedCode()}</code>
              </pre>

              {/* 복사 버튼 */}
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4 text-green-500" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" />
                    복사
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 설치 안내 - 탭별로 다른 내용 */}
          <TabsContent value="javascript" className="mt-4 space-y-3">
            <InstallGuide>
              위 코드를 웹사이트의{' '}
              <code className="text-primary">&lt;body&gt;</code> 태그 끝에
              붙여넣으세요. 페이지 우측 하단에 채팅 버튼이 나타납니다.
            </InstallGuide>
            <WarningNote />
          </TabsContent>

          <TabsContent value="iframe" className="mt-4 space-y-3">
            <InstallGuide>
              위 코드를 웹사이트에 붙여넣으세요. iframe은 고정 위치에 채팅창을
              표시합니다. 스타일은 필요에 따라 수정할 수 있습니다.
            </InstallGuide>
            <WarningNote />
          </TabsContent>

          <TabsContent value="react" className="mt-4 space-y-3">
            <InstallGuide>
              위 컴포넌트를 프로젝트에 추가하고, 앱의 최상위 레벨에서
              렌더링하세요. 예:{' '}
              <code className="text-primary">&lt;SofaChatWidget /&gt;</code>
            </InstallGuide>
            <WarningNote />
          </TabsContent>
      </Tabs>
    </Dialog>
  );
}

/** 설치 안내 박스 */
function InstallGuide({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-primary/10 p-3">
      <h4 className="mb-1 text-sm font-medium text-primary">설치 방법</h4>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/** 주의 사항 박스 */
function WarningNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
      <div className="text-sm text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">주의 사항</p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>HTTPS 사이트에서만 정상 작동합니다.</li>
          <li>API 키는 공개되지만 도메인별 제한이 적용됩니다.</li>
          <li>한 페이지에 위젯을 중복 삽입하지 마세요.</li>
        </ul>
      </div>
    </div>
  );
}
