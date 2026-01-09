/**
 * Daum 우편번호 서비스 + Kakao Maps SDK 타입 선언
 *
 * @see https://postcode.map.daum.net/guide
 * @see https://apis.map.kakao.com/web/documentation/
 */

declare global {
  interface Window {
    daum: {
      Postcode: new (options: DaumPostcodeOptions) => DaumPostcodeInstance;
    };
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        /** 지도 생성자 */
        Map: new (
          container: HTMLElement,
          options: kakao.maps.MapOptions
        ) => kakao.maps.Map;
        /** 좌표 생성자 */
        LatLng: new (lat: number, lng: number) => kakao.maps.LatLng;
        /** 마커 생성자 */
        Marker: new (options: kakao.maps.MarkerOptions) => kakao.maps.Marker;
        services: {
          Geocoder: new () => KakaoGeocoder;
          Status: {
            OK: string;
            ZERO_RESULT: string;
            ERROR: string;
          };
        };
      };
    };
  }

  /**
   * Kakao Maps 네임스페이스
   */
  namespace kakao.maps {
    /** 지도 옵션 */
    interface MapOptions {
      /** 중심 좌표 */
      center: LatLng;
      /** 줌 레벨 (1~14, 숫자가 작을수록 확대) */
      level: number;
    }

    /** 지도 인스턴스 */
    interface Map {
      /** 중심 좌표 설정 */
      setCenter(latlng: LatLng): void;
      /** 중심 좌표 가져오기 */
      getCenter(): LatLng;
      /** 줌 레벨 설정 */
      setLevel(level: number): void;
      /** 줌 레벨 가져오기 */
      getLevel(): number;
      /** 지도 타입 설정 */
      setMapTypeId(mapTypeId: number): void;
    }

    /** 좌표 인스턴스 */
    interface LatLng {
      /** 위도 가져오기 */
      getLat(): number;
      /** 경도 가져오기 */
      getLng(): number;
    }

    /** 마커 옵션 */
    interface MarkerOptions {
      /** 마커 위치 */
      position: LatLng;
      /** 마커를 표시할 지도 */
      map?: Map;
    }

    /** 마커 인스턴스 */
    interface Marker {
      /** 지도에 마커 표시 */
      setMap(map: Map | null): void;
      /** 마커 위치 가져오기 */
      getPosition(): LatLng;
      /** 마커 위치 설정 */
      setPosition(position: LatLng): void;
    }

    namespace services {
      type Status = string;
    }
  }
}

/**
 * Daum 우편번호 서비스 옵션
 */
interface DaumPostcodeOptions {
  /** 주소 선택 완료 콜백 */
  oncomplete: (data: DaumPostcodeResult) => void;
  /** 검색창 닫힘 콜백 */
  onclose?: () => void;
  /** 검색창 크기 조절 콜백 */
  onresize?: (size: { width: number; height: number }) => void;
  /** 검색창 너비 */
  width?: string | number;
  /** 검색창 높이 */
  height?: string | number;
  /** 애니메이션 사용 여부 */
  animation?: boolean;
}

/**
 * Daum 우편번호 서비스 인스턴스
 */
interface DaumPostcodeInstance {
  /** 팝업으로 열기 */
  open: () => void;
  /** 특정 DOM 요소에 임베드 */
  embed: (element: HTMLElement) => void;
}

/**
 * Daum 우편번호 서비스 결과
 */
interface DaumPostcodeResult {
  /** 새 우편번호 (5자리) */
  zonecode: string;
  /** 기본 주소 (사용자 선택 타입에 따름) */
  address: string;
  /** 도로명 주소 */
  roadAddress: string;
  /** 지번 주소 */
  jibunAddress: string;
  /** 건물명 */
  buildingName: string;
  /** 사용자가 선택한 주소 타입 (R: 도로명, J: 지번) */
  userSelectedType: 'R' | 'J';
  /** 영문 도로명 주소 */
  addressEnglish: string;
  /** 영문 지번 주소 */
  jibunAddressEnglish: string;
  /** 시/도 */
  sido: string;
  /** 시/군/구 */
  sigungu: string;
  /** 동/읍/면 */
  bname: string;
  /** 법정동 코드 */
  bcode: string;
}

/**
 * Kakao Maps Geocoder
 */
interface KakaoGeocoder {
  /**
   * 주소로 좌표 검색
   * @param address - 검색할 주소
   * @param callback - 결과 콜백
   */
  addressSearch: (
    address: string,
    callback: (result: KakaoGeocoderResult[], status: string) => void
  ) => void;

  /**
   * 좌표로 주소 검색 (역 지오코딩)
   * @param coords - 좌표 객체
   * @param callback - 결과 콜백
   */
  coord2Address: (
    x: number,
    y: number,
    callback: (result: KakaoCoord2AddressResult[], status: string) => void
  ) => void;
}

/**
 * Kakao Geocoder 주소 검색 결과
 */
interface KakaoGeocoderResult {
  /** 경도 (longitude) */
  x: string;
  /** 위도 (latitude) */
  y: string;
  /** 주소명 */
  address_name: string;
  /** 주소 타입 */
  address_type: 'REGION' | 'ROAD' | 'REGION_ADDR' | 'ROAD_ADDR';
  /** 도로명 주소 정보 */
  road_address: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    road_name: string;
    building_name: string;
    zone_no: string;
  } | null;
  /** 지번 주소 정보 */
  address: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    mountain_yn: string;
    main_address_no: string;
    sub_address_no: string;
  };
}

/**
 * Kakao Geocoder 좌표→주소 변환 결과
 */
interface KakaoCoord2AddressResult {
  /** 도로명 주소 정보 */
  road_address: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    road_name: string;
    building_name: string;
    zone_no: string;
  } | null;
  /** 지번 주소 정보 */
  address: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    mountain_yn: string;
    main_address_no: string;
    sub_address_no: string;
  };
}

export {};
