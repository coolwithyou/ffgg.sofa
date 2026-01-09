'use client';

/**
 * 카카오맵 임베드 컴포넌트
 *
 * Kakao Maps JavaScript API를 사용하여 지도를 직접 렌더링합니다.
 * - 좌표 기반 또는 주소 기반 표시
 * - 마커 표시
 * - 줌 레벨 설정
 */

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { loadKakaoSDK, isKakaoSDKLoaded } from '@/lib/kakao-maps';

interface KakaoMapEmbedProps {
  /** 주소 */
  address: string;
  /** 위도 */
  lat?: number;
  /** 경도 */
  lng?: number;
  /** 줌 레벨 (1-14, 숫자가 작을수록 확대) */
  zoom: number;
  /** 높이 (px) */
  height: number;
}

/**
 * Kakao Maps 줌 레벨 변환
 * Google Maps: 1(세계) ~ 21(건물) - 숫자가 클수록 확대
 * Kakao Maps: 1(건물) ~ 14(세계) - 숫자가 작을수록 확대
 */
function convertZoomLevel(googleZoom: number): number {
  // Google 15 → Kakao 3 정도가 적당
  // 대략적인 변환: Kakao level = 22 - Google zoom
  const kakaoLevel = Math.max(1, Math.min(14, 22 - googleZoom));
  return kakaoLevel;
}

export function KakaoMapEmbed({
  address,
  lat,
  lng,
  zoom,
  height,
}: KakaoMapEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!containerRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        // SDK 로드 (이미 로드되어 있으면 즉시 반환)
        await loadKakaoSDK();

        if (!isMounted) return;

        // 좌표가 있으면 바로 사용, 없으면 주소로 검색
        let center: kakao.maps.LatLng;

        if (lat !== undefined && lng !== undefined && lat !== 0 && lng !== 0) {
          center = new window.kakao.maps.LatLng(lat, lng);
        } else if (address) {
          // 주소로 좌표 검색
          const geocoder = new window.kakao.maps.services.Geocoder();
          const coords = await new Promise<kakao.maps.LatLng>(
            (resolve, reject) => {
              geocoder.addressSearch(address, (result, status) => {
                if (
                  status === window.kakao.maps.services.Status.OK &&
                  result[0]
                ) {
                  resolve(
                    new window.kakao.maps.LatLng(
                      parseFloat(result[0].y),
                      parseFloat(result[0].x)
                    )
                  );
                } else {
                  reject(new Error('주소를 찾을 수 없습니다'));
                }
              });
            }
          );
          center = coords;
        } else {
          throw new Error('주소 또는 좌표가 필요합니다');
        }

        if (!isMounted) return;

        // 지도 생성
        const kakaoLevel = convertZoomLevel(zoom);
        const map = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: kakaoLevel,
        });

        // 마커 추가
        new window.kakao.maps.Marker({
          position: center,
          map,
        });

        mapRef.current = map;
        setIsLoading(false);
      } catch (err) {
        if (!isMounted) return;
        const message =
          err instanceof Error ? err.message : '지도를 불러올 수 없습니다';
        setError(message);
        setIsLoading(false);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      // 지도 정리 (kakao maps는 별도 destroy 메서드 없음)
      mapRef.current = null;
    };
  }, [address, lat, lng, zoom]);

  // 에러 상태
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        style={{ height: `${height}px` }}
      >
        <MapPin className="h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <a
          href={`https://map.kakao.com/?q=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline"
        >
          카카오맵에서 열기
        </a>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-muted"
      style={{ height: `${height}px` }}
    >
      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {/* 지도 컨테이너 */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
