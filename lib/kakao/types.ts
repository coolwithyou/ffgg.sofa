/**
 * 카카오 오픈빌더 타입 정의
 * [Week 8] 카카오톡 연동
 */

/**
 * 카카오 스킬 요청 - 사용자 정보
 */
export interface KakaoUser {
  id: string;
  type: 'botUserKey';
  properties?: Record<string, string>;
}

/**
 * 카카오 스킬 요청 - 봇 정보
 */
export interface KakaoBot {
  id: string;
  name: string;
}

/**
 * 카카오 스킬 요청 - 발화 블록 정보
 */
export interface KakaoBlock {
  id: string;
  name: string;
}

/**
 * 카카오 스킬 요청 - 발화 정보
 */
export interface KakaoUtterance {
  utterance: string;
  params?: Record<string, string>;
}

/**
 * 카카오 스킬 요청 - Action
 */
export interface KakaoAction {
  id: string;
  name: string;
  params: Record<string, string>;
  detailParams?: Record<string, {
    origin: string;
    value: string;
    groupName?: string;
  }>;
  clientExtra?: Record<string, unknown>;
}

/**
 * 카카오 스킬 요청 본문
 */
export interface KakaoSkillRequest {
  intent?: {
    id: string;
    name: string;
  };
  userRequest: {
    timezone: string;
    params?: {
      ignoreMe?: string;
      surface?: string;
    };
    block?: KakaoBlock;
    utterance: string;
    lang?: string;
    user: KakaoUser;
  };
  bot?: KakaoBot;
  action?: KakaoAction;
  contexts?: unknown[];
}

/**
 * 카카오 응답 - 간단 텍스트
 */
export interface KakaoSimpleText {
  simpleText: {
    text: string;
  };
}

/**
 * 카카오 응답 - 텍스트 카드
 */
export interface KakaoTextCard {
  textCard: {
    title: string;
    description: string;
    buttons?: KakaoButton[];
  };
}

/**
 * 카카오 응답 - 버튼
 */
export interface KakaoButton {
  label: string;
  action: 'webLink' | 'message' | 'block' | 'phone' | 'share' | 'operator';
  webLinkUrl?: string;
  messageText?: string;
  blockId?: string;
  phoneNumber?: string;
  extra?: Record<string, unknown>;
}

/**
 * 카카오 응답 - 바로연결
 */
export interface KakaoQuickReply {
  label: string;
  action: 'message' | 'block';
  messageText?: string;
  blockId?: string;
  extra?: Record<string, unknown>;
}

/**
 * 카카오 스킬 응답 템플릿
 */
export interface KakaoSkillTemplate {
  outputs: (KakaoSimpleText | KakaoTextCard)[];
  quickReplies?: KakaoQuickReply[];
}

/**
 * 카카오 스킬 응답 본문
 */
export interface KakaoSkillResponse {
  version: '2.0';
  template: KakaoSkillTemplate;
  context?: {
    values: Array<{
      name: string;
      lifeSpan: number;
      params?: Record<string, string>;
    }>;
  };
  data?: Record<string, unknown>;
}

/**
 * 테넌트 카카오 설정
 */
export interface TenantKakaoSettings {
  botId: string;
  skillUrl?: string;
  maxResponseLength?: number; // 기본 300자
  welcomeMessage?: string;
}
