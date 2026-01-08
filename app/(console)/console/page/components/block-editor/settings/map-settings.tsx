'use client';

/**
 * 지도 블록 설정 컴포넌트
 *
 * MapBlock의 설정을 편집합니다:
 * - 제공자: Google, Kakao, Naver
 * - 표시 타입: embed (지도 임베드) / button (버튼만)
 * - 주소 (Daum 우편번호 서비스로 검색 가능)
 * - 좌표 (주소 검색 시 자동 입력, 수동 수정 가능)
 * - 줌 레벨
 * - 높이 (embed 모드에서만)
 */

import { useState } from 'react';
import { MapPin, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDaumPostcode, type AddressResult } from '@/hooks/use-daum-postcode';
import type { MapBlock, MapProvider, MapDisplayType } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const PROVIDER_OPTIONS: { value: MapProvider; label: string }[] = [
  { value: 'google', label: 'Google Maps' },
  { value: 'kakao', label: '카카오맵' },
  { value: 'naver', label: '네이버지도' },
];

const DISPLAY_TYPE_OPTIONS: {
  value: MapDisplayType;
  label: string;
  description: string;
}[] = [
  {
    value: 'embed',
    label: '지도 임베드',
    description: '페이지에 지도를 직접 표시합니다',
  },
  {
    value: 'button',
    label: '버튼만 표시',
    description: '클릭 시 지도 앱/웹으로 연결됩니다',
  },
];

export function MapBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<MapBlock>) {
  const { config } = block;
  const [showPostcode, setShowPostcode] = useState(false);

  const { containerRef, openPostcode, error, clearError } = useDaumPostcode();

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<MapBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<MapBlock>);
  };

  /**
   * 좌표 입력 파싱
   */
  const handleCoordChange = (coord: 'lat' | 'lng', value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      updateConfig({ [coord]: numValue });
    } else if (value === '') {
      updateConfig({ [coord]: undefined });
    }
  };

  /**
   * 주소 검색 토글 (열기/닫기)
   */
  const handleTogglePostcode = async () => {
    // 이미 열려있으면 닫기
    if (showPostcode) {
      setShowPostcode(false);
      clearError();
      return;
    }

    // 닫혀있으면 열기
    setShowPostcode(true);
    clearError();

    // 약간의 딜레이 후 검색창 열기 (DOM 렌더링 대기)
    await new Promise((resolve) => setTimeout(resolve, 100));

    openPostcode((result: AddressResult) => {
      // 주소, 위도, 경도 일괄 업데이트
      updateConfig({
        address: result.address,
        lat: result.lat || undefined,
        lng: result.lng || undefined,
      });

      // 검색창 닫기
      setShowPostcode(false);
    });
  };

  // 좌표 유효성 확인
  const hasValidCoords =
    config.lat !== undefined &&
    config.lng !== undefined &&
    config.lat !== 0 &&
    config.lng !== 0;

  return (
    <div className="space-y-4">
      {/* 제공자 선택 */}
      <div className="space-y-2">
        <Label htmlFor="map-provider">지도 서비스</Label>
        <Select
          value={config.provider}
          onValueChange={(value: MapProvider) =>
            updateConfig({ provider: value })
          }
        >
          <SelectTrigger id="map-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config.provider === 'naver' && (
          <p className="text-xs text-muted-foreground">
            네이버지도는 별도 API 키가 필요하여 외부 링크로 연결됩니다.
          </p>
        )}
      </div>

      {/* 표시 타입 */}
      <div className="space-y-2">
        <Label htmlFor="map-display-type">표시 방식</Label>
        <Select
          value={config.displayType ?? 'embed'}
          onValueChange={(value: MapDisplayType) =>
            updateConfig({ displayType: value })
          }
        >
          <SelectTrigger id="map-display-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISPLAY_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {(config.displayType ?? 'embed') === 'embed'
            ? config.provider === 'google'
              ? '페이지에 Google Maps 지도가 직접 표시됩니다'
              : config.provider === 'kakao'
                ? '페이지에 카카오맵 지도가 직접 표시됩니다'
                : '네이버지도는 별도 API 키가 필요하여 링크 카드로 표시됩니다'
            : '버튼 클릭 시 선택한 지도 서비스로 이동합니다'}
        </p>
      </div>

      {/* 주소 */}
      <div className="space-y-2">
        <Label htmlFor="map-address">주소</Label>
        <div className="flex gap-2">
          <Input
            id="map-address"
            placeholder="주소찾기 버튼을 클릭하세요"
            value={config.address}
            readOnly
            className="flex-1 cursor-pointer bg-muted/50"
            onClick={handleTogglePostcode}
          />
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleTogglePostcode}
          >
            <MapPin className="mr-1 h-4 w-4" />
            주소찾기
            {showPostcode ? (
              <ChevronUp className="ml-1 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-1 h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          주소찾기를 클릭하여 주소를 검색하세요. 좌표가 자동으로 입력됩니다.
        </p>

        {/* 인라인 주소검색 영역 */}
        {showPostcode && (
          <div className="relative mt-2 overflow-hidden rounded-md border border-border">
            {/* 닫기 버튼 */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 h-6 w-6 bg-background/80 hover:bg-background"
              onClick={handleTogglePostcode}
            >
              <X className="h-4 w-4" />
            </Button>
            {/* Daum Postcode 임베드 영역 */}
            <div ref={containerRef} className="h-[400px] w-full" />
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>

      {/* 위치명 (선택) */}
      <div className="space-y-2">
        <Label htmlFor="map-place-name">위치명 (선택)</Label>
        <Input
          id="map-place-name"
          placeholder="예: 강남역 2번 출구"
          value={config.placeName ?? ''}
          onChange={(e) => updateConfig({ placeName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          마커 위에 표시할 위치명입니다. 비워두면 마커만 표시됩니다.
        </p>
      </div>

      {/* 좌표 (선택) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>좌표 (선택)</Label>
          {hasValidCoords && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" />
              자동 입력됨
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label
              htmlFor="map-lat"
              className="text-xs text-muted-foreground"
            >
              위도
            </Label>
            <Input
              id="map-lat"
              type="number"
              step="any"
              placeholder="37.5665"
              value={config.lat ?? ''}
              onChange={(e) => handleCoordChange('lat', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="map-lng"
              className="text-xs text-muted-foreground"
            >
              경도
            </Label>
            <Input
              id="map-lng"
              type="number"
              step="any"
              placeholder="126.9780"
              value={config.lng ?? ''}
              onChange={(e) => handleCoordChange('lng', e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          좌표를 입력하면 주소 대신 정확한 위치를 표시합니다.
        </p>
      </div>

      {/* 줌 레벨 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="map-zoom">줌 레벨</Label>
          <span className="text-sm text-muted-foreground">{config.zoom}</span>
        </div>
        <Slider
          id="map-zoom"
          value={[config.zoom]}
          min={1}
          max={21}
          step={1}
          onValueChange={([value]) => updateConfig({ zoom: value })}
        />
        <p className="text-xs text-muted-foreground">
          1: 세계 전체, 15: 거리 수준, 21: 건물 수준
        </p>
      </div>

      {/* 높이 (embed 모드에서만) */}
      {(config.displayType ?? 'embed') === 'embed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="map-height">높이</Label>
            <span className="text-sm text-muted-foreground">
              {config.height ?? 300}px
            </span>
          </div>
          <Slider
            id="map-height"
            value={[config.height ?? 300]}
            min={150}
            max={600}
            step={50}
            onValueChange={([value]) => updateConfig({ height: value })}
          />
          <p className="text-xs text-muted-foreground">
            지도 블록의 높이입니다. (150-600px)
          </p>
        </div>
      )}
    </div>
  );
}
