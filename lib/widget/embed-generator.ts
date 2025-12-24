/**
 * 임베드 코드 생성기
 * [Week 7] 테넌트별 위젯 임베드 코드 생성
 */

/**
 * JavaScript 문자열 이스케이프 (XSS 방지)
 */
function escapeForScript(str: string): string {
  return str.replace(/[\\'"\n\r]/g, (c) => ({
    '\\': '\\\\',
    "'": "\\'",
    '"': '\\"',
    '\n': '\\n',
    '\r': '\\r',
  })[c] ?? c);
}

/**
 * HTML 속성 이스케이프 (XSS 방지)
 */
function escapeForHtmlAttr(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] ?? c);
}

/**
 * 임베드 설정 입력 타입 (Zod 파싱 결과와 호환)
 */
interface EmbedConfigInput {
  position?: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    borderRadius?: number;
    buttonSize?: number;
  };
  title?: string;
  subtitle?: string;
  placeholder?: string;
  welcomeMessage?: string;
  buttonIcon?: string;
}

/**
 * 위젯 임베드 스크립트 코드 생성
 */
export function generateEmbedScript(
  tenantId: string,
  apiKey: string,
  config: EmbedConfigInput = {}
): string {
  const baseUrl = process.env.NEXT_PUBLIC_WIDGET_URL || 'https://widget.example.com';

  // XSS 방지를 위해 입력값 이스케이프
  const safeApiKey = escapeForScript(apiKey);
  const safeTenantId = escapeForScript(tenantId);
  const configJson = JSON.stringify({
    tenantId: safeTenantId,
    ...config,
  });

  return `<!-- SOFA Chat Widget -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['SofaChat']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','sofa','${baseUrl}/widget.js'));
  sofa('init', {
    apiKey: '${safeApiKey}',
    config: ${configJson}
  });
</script>
<!-- End SOFA Chat Widget -->`;
}

/**
 * iframe 임베드 코드 생성
 */
export function generateIframeEmbed(
  tenantId: string,
  apiKey: string,
  options: {
    width?: string;
    height?: string;
  } = {}
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com';
  const { width = '400px', height = '600px' } = options;

  // XSS 방지를 위해 입력값 이스케이프
  const safeTenantId = escapeForHtmlAttr(tenantId);
  const safeApiKey = escapeForHtmlAttr(apiKey);
  const safeWidth = escapeForHtmlAttr(width);
  const safeHeight = escapeForHtmlAttr(height);

  return `<!-- SOFA Chat Widget (iframe) -->
<iframe
  src="${baseUrl}/widget/${safeTenantId}?key=${safeApiKey}"
  width="${safeWidth}"
  height="${safeHeight}"
  frameborder="0"
  allow="clipboard-write"
  style="border: none; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);"
></iframe>
<!-- End SOFA Chat Widget -->`;
}

/**
 * React 컴포넌트 코드 생성
 */
export function generateReactEmbed(
  tenantId: string,
  apiKey: string
): string {
  // XSS 방지를 위해 입력값 이스케이프
  const safeApiKey = escapeForScript(apiKey);
  const safeTenantId = escapeForScript(tenantId);
  const widgetUrl = process.env.NEXT_PUBLIC_WIDGET_URL || 'https://widget.example.com';

  return `// SOFA Chat Widget for React
import { useEffect } from 'react';

export function SofaChatWidget() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${widgetUrl}/widget.js';
    script.async = true;
    script.onload = () => {
      window.sofa('init', {
        apiKey: '${safeApiKey}',
        config: { tenantId: '${safeTenantId}' }
      });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}`;
}

/**
 * 위젯 설정 검증
 */
export function validateWidgetConfig(
  config: EmbedConfigInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.theme?.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.theme.primaryColor)) {
    errors.push('primaryColor는 HEX 컬러 형식이어야 합니다 (예: #3B82F6)');
  }

  if (config.theme?.backgroundColor && !/^#[0-9A-Fa-f]{6}$/.test(config.theme.backgroundColor)) {
    errors.push('backgroundColor는 HEX 컬러 형식이어야 합니다');
  }

  if (config.theme?.borderRadius !== undefined && (config.theme.borderRadius < 0 || config.theme.borderRadius > 32)) {
    errors.push('borderRadius는 0-32 범위여야 합니다');
  }

  if (config.theme?.buttonSize !== undefined && (config.theme.buttonSize < 40 || config.theme.buttonSize > 80)) {
    errors.push('buttonSize는 40-80 범위여야 합니다');
  }

  if (config.title && config.title.length > 50) {
    errors.push('title은 50자 이하여야 합니다');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
