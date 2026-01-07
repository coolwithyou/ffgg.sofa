/**
 * Daum 우편번호 서비스 + Kakao Maps SDK 동적 로더
 *
 * 지도 블록 설정을 열 때만 SDK를 동적으로 로드하여
 * 초기 페이지 로드 성능을 최적화합니다.
 *
 * @example
 * ```tsx
 * import { loadKakaoSDK } from '@/lib/kakao-maps';
 *
 * async function openAddressSearch() {
 *   await loadKakaoSDK();
 *   // window.daum.Postcode, window.kakao.maps 사용 가능
 * }
 * ```
 */

let isLoading = false;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Kakao Maps SDK + Daum Postcode 서비스 로드
 *
 * - 이미 로드된 경우 즉시 반환
 * - 로딩 중인 경우 기존 Promise 반환 (중복 로드 방지)
 * - 최초 호출 시 스크립트 동적 삽입
 */
export async function loadKakaoSDK(): Promise<void> {
  // 이미 로드 완료
  if (isLoaded) return;

  // 로딩 중이면 기존 Promise 반환
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;

  loadPromise = (async () => {
    try {
      // 1. Daum Postcode 서비스 로드
      await loadScript(
        '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      );

      // 2. Kakao Maps SDK 로드 (services 라이브러리 포함)
      const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (!kakaoKey) {
        throw new Error(
          'NEXT_PUBLIC_KAKAO_JS_KEY 환경변수가 설정되지 않았습니다. ' +
            'Kakao Developers 콘솔에서 JavaScript 키를 발급받아 설정해주세요.'
        );
      }

      await loadScript(
        `//dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`
      );

      // 3. Kakao Maps 초기화 (autoload=false이므로 수동 호출 필요)
      await new Promise<void>((resolve, reject) => {
        if (!window.kakao?.maps?.load) {
          reject(new Error('Kakao Maps SDK 로드 실패'));
          return;
        }
        window.kakao.maps.load(resolve);
      });

      isLoaded = true;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

/**
 * SDK 로드 상태 확인
 */
export function isKakaoSDKLoaded(): boolean {
  return isLoaded;
}

/**
 * 스크립트 동적 로드 유틸리티
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 프로토콜 상대 URL 처리 (// 로 시작하는 경우)
    const fullSrc = src.startsWith('//') ? `https:${src}` : src;

    // 이미 로드된 스크립트 확인
    const existingScript = document.querySelector(
      `script[src="${fullSrc}"], script[src="${src}"]`
    );
    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = fullSrc;
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`스크립트 로드 실패: ${fullSrc}`));

    document.head.appendChild(script);
  });
}
