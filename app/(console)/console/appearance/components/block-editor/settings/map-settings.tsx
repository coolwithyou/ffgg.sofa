'use client';

/**
 * 지도 블록 설정 컴포넌트
 *
 * MapBlock의 설정을 편집합니다:
 * - 제공자: Google, Kakao, Naver
 * - 주소
 * - 좌표 (선택)
 * - 줌 레벨
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MapBlock, MapProvider } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const PROVIDER_OPTIONS: { value: MapProvider; label: string }[] = [
  { value: 'google', label: 'Google Maps' },
  { value: 'kakao', label: '카카오맵' },
  { value: 'naver', label: '네이버지도' },
];

export function MapBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<MapBlock>) {
  const { config } = block;

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
  const handleCoordChange = (
    coord: 'lat' | 'lng',
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      updateConfig({ [coord]: numValue });
    } else if (value === '') {
      updateConfig({ [coord]: undefined });
    }
  };

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
        {config.provider !== 'google' && (
          <p className="text-xs text-muted-foreground">
            {config.provider === 'kakao' ? '카카오맵' : '네이버지도'}은 외부 링크로 연결됩니다.
          </p>
        )}
      </div>

      {/* 주소 */}
      <div className="space-y-2">
        <Label htmlFor="map-address">주소</Label>
        <Input
          id="map-address"
          placeholder="서울시 강남구 테헤란로 123"
          value={config.address}
          onChange={(e) => updateConfig({ address: e.target.value })}
        />
      </div>

      {/* 좌표 (선택) */}
      <div className="space-y-2">
        <Label>좌표 (선택)</Label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="map-lat" className="text-xs text-muted-foreground">
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
            <Label htmlFor="map-lng" className="text-xs text-muted-foreground">
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
    </div>
  );
}
