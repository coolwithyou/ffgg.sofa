'use client';

/**
 * 지도 블록 컴포넌트
 *
 * Google Maps, Kakao Map, Naver Map을 임베드합니다.
 * - 주소 기반 표시
 * - 줌 레벨 설정
 * - 좌표 직접 지정 옵션
 * - 표시 타입: embed (지도 임베드) / button (버튼만)
 */

import { MapPin } from 'lucide-react';
import type { MapProvider, MapDisplayType } from '@/lib/public-page/block-types';
import { KakaoMapEmbed } from './kakao-map-embed';

interface MapBlockProps {
  provider: MapProvider;
  address: string;
  lat?: number;
  lng?: number;
  zoom: number;
  /** 표시 타입 (기본: embed) */
  displayType?: MapDisplayType;
  /** 임베드 모드 높이 (px, 기본: 300) */
  height?: number;
  /** 위치명 (마커 위 InfoWindow에 표시) */
  placeName?: string;
}

/**
 * 지도 열기 링크 URL 생성
 */
function getMapLinkUrl(
  provider: MapProvider,
  address: string,
  lat?: number,
  lng?: number
): string {
  const encodedAddress = encodeURIComponent(address);

  switch (provider) {
    case 'google':
      if (lat !== undefined && lng !== undefined) {
        return `https://www.google.com/maps?q=${lat},${lng}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    case 'kakao':
      return `https://map.kakao.com/?q=${encodedAddress}`;
    case 'naver':
      return `https://map.naver.com/?query=${encodedAddress}`;
    default:
      return '#';
  }
}

/**
 * 제공자 이름 가져오기
 */
function getProviderName(provider: MapProvider): string {
  switch (provider) {
    case 'google':
      return 'Google Maps';
    case 'kakao':
      return '카카오맵';
    case 'naver':
      return '네이버지도';
    default:
      return '지도';
  }
}

export function MapBlock({
  provider,
  address,
  lat,
  lng,
  zoom,
  displayType = 'embed',
  height = 300,
  placeName,
}: MapBlockProps) {
  // 주소가 없으면 플레이스홀더 표시
  if (!address || address.trim() === '') {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
        <span className="text-muted-foreground">주소를 입력하세요</span>
      </div>
    );
  }

  const mapUrl = getMapLinkUrl(provider, address, lat, lng);
  const providerName = getProviderName(provider);

  // button 모드: 버튼만 표시
  if (displayType === 'button') {
    return (
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <MapPin className="h-4 w-4" />
        {providerName}에서 보기
      </a>
    );
  }

  // embed 모드: Google Maps만 iframe 임베드 지원
  if (provider === 'google') {
    // 데모 모드: API 키 없이 작동하는 simple embed
    const embedUrl =
      lat !== undefined && lng !== undefined
        ? `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`
        : `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=${zoom}&output=embed`;

    return (
      <div
        className="relative w-full overflow-hidden rounded-xl bg-muted"
        style={{ height: `${height}px` }}
      >
        <iframe
          src={embedUrl}
          title="지도"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
        {/* placeName 오버레이 (iframe에는 InfoWindow 불가하므로 오버레이로 표시) */}
        {placeName && placeName.trim() && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
            <div className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-lg">
              {placeName}
            </div>
          </div>
        )}
      </div>
    );
  }

  // embed 모드: Kakao Maps JavaScript API 사용
  if (provider === 'kakao') {
    return (
      <KakaoMapEmbed
        address={address}
        lat={lat}
        lng={lng}
        zoom={zoom}
        height={height}
        placeName={placeName}
      />
    );
  }

  // embed 모드지만 Naver는 API 키 필수이므로 카드 형태로 안내
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-muted/30 p-8"
      style={{ height: `${height}px` }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MapPin className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="font-medium text-foreground">{address}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {providerName}은 별도 API 키가 필요하여 직접 표시가 불가능합니다
        </p>
      </div>
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <MapPin className="h-4 w-4" />
        {providerName}에서 열기
      </a>
    </div>
  );
}
