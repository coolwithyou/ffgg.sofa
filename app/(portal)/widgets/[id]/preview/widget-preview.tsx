'use client';

/**
 * 위젯 미리보기 컴포넌트
 * 다양한 배경에서 위젯이 어떻게 보이는지 테스트
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  Sun,
  Moon,
  Palette,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface ChatbotInfo {
  id: string;
  name: string;
  tenantId: string;
  widgetEnabled: boolean;
  widgetApiKey: string | null;
  widgetConfig: Record<string, unknown>;
}

interface WidgetPreviewProps {
  chatbot: ChatbotInfo;
}

type DeviceType = 'desktop' | 'mobile';
type BackgroundType = 'light' | 'dark' | 'brand' | 'image';

const BACKGROUNDS: Record<BackgroundType, { label: string; style: string }> = {
  light: {
    label: '라이트',
    style: 'bg-white',
  },
  dark: {
    label: '다크',
    style: 'bg-gray-900',
  },
  brand: {
    label: '브랜드',
    style: 'bg-gradient-to-br from-blue-500 to-purple-600',
  },
  image: {
    label: '이미지',
    style: 'bg-[url("https://images.unsplash.com/photo-1557683316-973673baf926?w=1200")] bg-cover bg-center',
  },
};

export function WidgetPreview({ chatbot }: WidgetPreviewProps) {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [background, setBackground] = useState<BackgroundType>('light');
  const [iframeKey, setIframeKey] = useState(0);

  // iframe 새로고침
  const refreshPreview = () => {
    setIframeKey((prev) => prev + 1);
  };

  // 기본 URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const previewUrl = chatbot.widgetApiKey
    ? `${baseUrl}/widget/${chatbot.tenantId}?key=${chatbot.widgetApiKey}`
    : null;

  // 디바이스 크기
  const deviceSize = device === 'desktop'
    ? { width: '100%', height: '100%' }
    : { width: '375px', height: '667px' };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/widgets"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            뒤로
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-sm font-medium text-foreground">
              {chatbot.name}
            </h1>
            <p className="text-xs text-muted-foreground">위젯 미리보기</p>
          </div>
        </div>

        {/* 컨트롤 */}
        <div className="flex items-center gap-4">
          {/* 디바이스 선택 */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                device === 'desktop'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Monitor className="h-4 w-4" />
              데스크톱
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                device === 'mobile'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              모바일
            </button>
          </div>

          {/* 배경 선택 */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(BACKGROUNDS) as BackgroundType[]).map((bg) => {
              const Icon = bg === 'light' ? Sun : bg === 'dark' ? Moon : Palette;
              return (
                <button
                  key={bg}
                  onClick={() => setBackground(bg)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    background === bg
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={BACKGROUNDS[bg].label}
                >
                  {bg === 'image' ? (
                    <span className="text-xs">🖼️</span>
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </button>
              );
            })}
          </div>

          {/* 설정 링크 */}
          <Link
            href={`/chatbots/${chatbot.id}?tab=widget`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            위젯 설정
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* 미리보기 영역 */}
      <div className="flex-1 overflow-hidden p-4">
        {!chatbot.widgetEnabled || !chatbot.widgetApiKey ? (
          // 위젯 비활성화 상태
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mb-2 font-medium text-foreground">
                위젯이 비활성화 상태입니다
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                미리보기를 사용하려면 먼저 위젯을 활성화해주세요.
              </p>
              <Link
                href="/widgets"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                위젯 관리로 이동
              </Link>
            </div>
          </div>
        ) : (
          // 미리보기 컨테이너
          <div className="flex h-full items-center justify-center">
            <div
              className={`relative overflow-hidden rounded-xl border border-border shadow-2xl transition-all duration-300 ${
                device === 'mobile' ? 'rounded-[2.5rem]' : ''
              }`}
              style={deviceSize}
            >
              {/* 모바일 노치 */}
              {device === 'mobile' && (
                <div className="absolute left-1/2 top-2 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
              )}

              {/* 배경 레이어 */}
              <div className={`absolute inset-0 ${BACKGROUNDS[background].style}`}>
                {/* 샘플 콘텐츠 (실제 웹사이트처럼 보이게) */}
                <div className="h-full p-6">
                  <div
                    className={`mb-6 h-8 w-32 rounded ${
                      background === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                    }`}
                  />
                  <div className="space-y-3">
                    <div
                      className={`h-4 w-full rounded ${
                        background === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                      }`}
                    />
                    <div
                      className={`h-4 w-3/4 rounded ${
                        background === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                      }`}
                    />
                    <div
                      className={`h-4 w-5/6 rounded ${
                        background === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                      }`}
                    />
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`aspect-video rounded-lg ${
                          background === 'dark' ? 'bg-gray-800' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* 위젯 iframe */}
              <div className="absolute bottom-5 right-5 z-10">
                {/* 플로팅 버튼 시뮬레이션 */}
                <WidgetSimulator
                  key={iframeKey}
                  previewUrl={previewUrl!}
                  config={chatbot.widgetConfig}
                  device={device}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 안내 */}
      <div className="border-t border-border bg-muted/50 px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">
          💡 실제 외부 사이트에서는 <code className="rounded bg-muted px-1 py-0.5">widget.js</code> 스크립트가
          플로팅 버튼을 생성합니다. 여기서는 시뮬레이션된 미리보기를 제공합니다.
        </p>
      </div>
    </div>
  );
}

/**
 * 위젯 시뮬레이터 - 플로팅 버튼 + iframe 채팅창
 */
function WidgetSimulator({
  previewUrl,
  config,
  device,
}: {
  previewUrl: string;
  config: Record<string, unknown>;
  device: DeviceType;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const primaryColor = (config.primaryColor as string) || '#3B82F6';
  const buttonSize = device === 'mobile' ? 48 : 56;

  // 채팅창 크기
  const chatSize = device === 'mobile'
    ? { width: 320, height: 450 }
    : { width: 380, height: 550 };

  return (
    <div className="relative">
      {/* 채팅창 */}
      {isOpen && (
        <div
          className="absolute bottom-16 right-0 overflow-hidden rounded-2xl shadow-2xl transition-all duration-300"
          style={{
            width: chatSize.width,
            height: chatSize.height,
          }}
        >
          <iframe
            src={previewUrl}
            className="h-full w-full border-none"
            title="Widget preview"
          />
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{
          width: buttonSize,
          height: buttonSize,
          backgroundColor: primaryColor,
        }}
      >
        {isOpen ? (
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" strokeWidth={2} strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
