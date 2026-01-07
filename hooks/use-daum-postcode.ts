'use client';

/**
 * Daum 우편번호 서비스 + Kakao Geocoder 통합 훅
 *
 * 주소 검색과 좌표 변환을 한 번에 처리합니다.
 *
 * @example
 * ```tsx
 * function AddressSearch() {
 *   const { containerRef, openPostcode, isLoading, error } = useDaumPostcode();
 *
 *   const handleAddressComplete = (result: AddressResult) => {
 *     console.log(result.address, result.lat, result.lng);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={() => openPostcode(handleAddressComplete)}>
 *         주소찾기
 *       </button>
 *       <div ref={containerRef} className="h-[400px]" />
 *       {error && <p className="text-red-500">{error}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useRef, useState } from 'react';
import { loadKakaoSDK } from '@/lib/kakao-maps';

/**
 * 주소 검색 결과
 */
export interface AddressResult {
  /** 기본 주소 (도로명 우선) */
  address: string;
  /** 도로명 주소 */
  roadAddress: string;
  /** 지번 주소 */
  jibunAddress: string;
  /** 우편번호 (5자리) */
  zonecode: string;
  /** 위도 (latitude) */
  lat: number;
  /** 경도 (longitude) */
  lng: number;
}

/**
 * 훅 반환 타입
 */
export interface UseDaumPostcodeReturn {
  /** 주소 검색창이 렌더링될 컨테이너 ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 주소 검색창 열기 */
  openPostcode: (onComplete: (result: AddressResult) => void) => Promise<void>;
  /** 로딩 상태 */
  isLoading: boolean;
  /** SDK 로드 완료 여부 */
  isSDKReady: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 에러 초기화 */
  clearError: () => void;
}

/**
 * Daum 우편번호 서비스 + Kakao Geocoder 통합 훅
 */
export function useDaumPostcode(): UseDaumPostcodeReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * SDK 로드 및 주소 검색창 열기
   */
  const openPostcode = useCallback(
    async (onComplete: (result: AddressResult) => void) => {
      if (!containerRef.current) {
        setError('검색창 영역이 준비되지 않았습니다.');
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        // SDK 로드 (최초 1회만, 이후는 캐시됨)
        await loadKakaoSDK();
        setIsSDKReady(true);

        // Daum Postcode 검색창 열기 (embed 방식)
        new window.daum.Postcode({
          oncomplete: (data) => {
            // 도로명 주소 우선, 없으면 지번 주소
            const address = data.roadAddress || data.jibunAddress;

            // 디버깅: Daum Postcode 반환 데이터 확인
            console.log('[Daum Postcode] 주소 선택:', {
              address,
              roadAddress: data.roadAddress,
              jibunAddress: data.jibunAddress,
              zonecode: data.zonecode,
            });

            // Kakao Geocoder로 좌표 변환
            const geocoder = new window.kakao.maps.services.Geocoder();

            console.log('[Kakao Geocoder] 좌표 변환 시작:', address);

            geocoder.addressSearch(address, (result, status) => {
              // 디버깅: Geocoder 응답 확인
              console.log('[Kakao Geocoder] 응답:', { status, result });

              if (
                status === window.kakao.maps.services.Status.OK &&
                result[0]
              ) {
                // 좌표 변환 성공
                const lat = parseFloat(result[0].y);
                const lng = parseFloat(result[0].x);

                console.log('[Kakao Geocoder] 좌표 변환 성공:', { lat, lng });

                onComplete({
                  address,
                  roadAddress: data.roadAddress,
                  jibunAddress: data.jibunAddress,
                  zonecode: data.zonecode,
                  lat,
                  lng,
                });
              } else {
                // 좌표 변환 실패해도 주소는 입력 (graceful degradation)
                console.warn('[Kakao Geocoder] 좌표 변환 실패:', status);

                onComplete({
                  address,
                  roadAddress: data.roadAddress,
                  jibunAddress: data.jibunAddress,
                  zonecode: data.zonecode,
                  lat: 0,
                  lng: 0,
                });
                setError('좌표를 찾을 수 없어 수동 입력이 필요합니다.');
              }
              setIsLoading(false);
            });
          },
          onclose: () => {
            setIsLoading(false);
          },
          width: '100%',
          height: '100%',
        }).embed(containerRef.current);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'SDK 로드에 실패했습니다.';
        setError(message);
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * 에러 초기화
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    containerRef,
    openPostcode,
    isLoading,
    isSDKReady,
    error,
    clearError,
  };
}
