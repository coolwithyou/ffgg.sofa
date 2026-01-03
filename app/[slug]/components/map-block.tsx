'use client';

/**
 * 지도 블록 컴포넌트
 *
 * Google Maps, Kakao Map, Naver Map을 임베드합니다.
 * - 주소 기반 표시
 * - 줌 레벨 설정
 * - 좌표 직접 지정 옵션
 */

import type { MapProvider } from '@/lib/public-page/block-types';

interface MapBlockProps {
  provider: MapProvider;
  address: string;
  lat?: number;
  lng?: number;
  zoom: number;
}

/**
 * 지도 제공자별 임베드 URL 생성
 */
function getMapEmbedUrl(
  provider: MapProvider,
  address: string,
  lat?: number,
  lng?: number,
  zoom?: number
): string {
  const encodedAddress = encodeURIComponent(address);

  switch (provider) {
    case 'google':
      if (lat !== undefined && lng !== undefined) {
        return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d${Math.pow(2, 20 - (zoom || 15))}!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM!5e0!3m2!1sko!2skr!4v1`;
      }
      return `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodedAddress}&zoom=${zoom || 15}`;
    case 'kakao':
      // Kakao Map 임베드 (실제 구현에서는 Kakao Maps SDK 사용 필요)
      return `https://map.kakao.com/?q=${encodedAddress}`;
    case 'naver':
      // Naver Map 임베드 (실제 구현에서는 Naver Maps SDK 사용 필요)
      return `https://map.naver.com/?query=${encodedAddress}`;
    default:
      return '';
  }
}

export function MapBlock({
  provider,
  address,
  lat,
  lng,
  zoom,
}: MapBlockProps) {
  // 주소가 없으면 플레이스홀더 표시
  if (!address || address.trim() === '') {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
        <span className="text-muted-foreground">주소를 입력하세요</span>
      </div>
    );
  }

  // Google Maps만 iframe 임베드 지원
  if (provider === 'google') {
    // 데모 모드: API 키 없이 작동하는 simple embed
    const embedUrl = lat !== undefined && lng !== undefined
      ? `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`
      : `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=${zoom}&output=embed`;

    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
        <iframe
          src={embedUrl}
          title="지도"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  // Kakao, Naver는 SDK 통합이 필요하므로 링크로 안내
  const mapUrl = getMapEmbedUrl(provider, address, lat, lng, zoom);
  const providerName = provider === 'kakao' ? '카카오맵' : '네이버지도';

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
      <div className="text-center">
        <p className="font-medium text-foreground">{address}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {providerName}에서 보기
        </p>
      </div>
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        지도 열기
      </a>
    </div>
  );
}
