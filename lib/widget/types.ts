/**
 * 챗봇 위젯 타입 정의
 * [Week 7] iframe 임베드 위젯
 */

/**
 * 위젯 설정
 */
export interface WidgetConfig {
  tenantId: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme: WidgetTheme;
  title: string;
  subtitle?: string;
  placeholder?: string;
  welcomeMessage?: string;
  buttonIcon?: 'chat' | 'question' | 'support';
}

/**
 * 위젯 테마
 */
export interface WidgetTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily?: string;
  borderRadius?: number;
  buttonSize?: number;
}

/**
 * 기본 테마
 */
export const DEFAULT_THEME: WidgetTheme = {
  primaryColor: '#3B82F6',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  borderRadius: 16,
  buttonSize: 56,
};

/**
 * 기본 위젯 설정
 */
export const DEFAULT_CONFIG: Omit<WidgetConfig, 'tenantId'> = {
  position: 'bottom-right',
  theme: DEFAULT_THEME,
  title: '도움이 필요하신가요?',
  subtitle: '무엇이든 물어보세요',
  placeholder: '메시지를 입력하세요...',
  welcomeMessage: '안녕하세요! 무엇을 도와드릴까요?',
  buttonIcon: 'chat',
};

/**
 * 위젯 메시지
 */
export interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Array<{
    documentId: string;
    chunkId: string;
    content: string;
    score: number;
  }>;
}

/**
 * 위젯 상태
 */
export interface WidgetState {
  isOpen: boolean;
  isLoading: boolean;
  messages: WidgetMessage[];
  sessionId: string | null;
  error: string | null;
}

/**
 * 임베드 코드 옵션
 */
export interface EmbedCodeOptions {
  tenantId: string;
  apiKey: string;
  config?: Partial<WidgetConfig>;
}

/**
 * 위젯 API 응답
 */
export interface WidgetChatResponse {
  message: string;
  sessionId: string;
  sources?: Array<{
    documentId: string;
    chunkId: string;
    content: string;
    score: number;
  }>;
  pointsBalance?: number;
}

/**
 * JSON 객체를 WidgetConfig로 파싱
 * DB에서 읽은 jsonb 값을 타입 안전한 WidgetConfig로 변환
 */
export function parseWidgetConfig(
  json: unknown,
  tenantId: string
): WidgetConfig {
  if (!json || typeof json !== 'object') {
    return { ...DEFAULT_CONFIG, tenantId };
  }

  const obj = json as Record<string, unknown>;
  const themeObj = (obj.theme as Record<string, unknown>) || {};

  return {
    tenantId: (obj.tenantId as string) || tenantId,
    position:
      (obj.position as WidgetConfig['position']) || DEFAULT_CONFIG.position,
    theme: {
      primaryColor:
        (themeObj.primaryColor as string) || DEFAULT_THEME.primaryColor,
      backgroundColor:
        (themeObj.backgroundColor as string) || DEFAULT_THEME.backgroundColor,
      textColor: (themeObj.textColor as string) || DEFAULT_THEME.textColor,
      fontFamily: (themeObj.fontFamily as string) || DEFAULT_THEME.fontFamily,
      borderRadius:
        typeof themeObj.borderRadius === 'number'
          ? themeObj.borderRadius
          : DEFAULT_THEME.borderRadius,
      buttonSize:
        typeof themeObj.buttonSize === 'number'
          ? themeObj.buttonSize
          : DEFAULT_THEME.buttonSize,
    },
    title: (obj.title as string) || DEFAULT_CONFIG.title,
    subtitle: (obj.subtitle as string) || DEFAULT_CONFIG.subtitle,
    placeholder: (obj.placeholder as string) || DEFAULT_CONFIG.placeholder,
    welcomeMessage:
      (obj.welcomeMessage as string) || DEFAULT_CONFIG.welcomeMessage,
    buttonIcon:
      (obj.buttonIcon as WidgetConfig['buttonIcon']) ||
      DEFAULT_CONFIG.buttonIcon,
  };
}

/**
 * WidgetConfig를 DB 저장용 JSON으로 변환
 */
export function toWidgetConfigJson(
  config: WidgetConfig
): Record<string, unknown> {
  return {
    tenantId: config.tenantId,
    position: config.position,
    theme: {
      primaryColor: config.theme.primaryColor,
      backgroundColor: config.theme.backgroundColor,
      textColor: config.theme.textColor,
      fontFamily: config.theme.fontFamily,
      borderRadius: config.theme.borderRadius,
      buttonSize: config.theme.buttonSize,
    },
    title: config.title,
    subtitle: config.subtitle,
    placeholder: config.placeholder,
    welcomeMessage: config.welcomeMessage,
    buttonIcon: config.buttonIcon,
  };
}
