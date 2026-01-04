'use client';

/**
 * 이미지 캐러셀 블록 설정 컴포넌트
 *
 * ImageCarouselBlock의 설정을 편집합니다:
 * - 이미지 목록 관리 (추가/삭제/수정)
 * - 자동 재생 설정
 * - 슬라이드 간격
 * - 도트/화살표 표시 옵션
 */

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type {
  ImageCarouselBlock,
  CarouselImageItem,
} from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';
import { ImageUploadField } from './image-upload-field';

export function ImageCarouselBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<ImageCarouselBlock>) {
  const { config } = block;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<ImageCarouselBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<ImageCarouselBlock>);
  };

  /**
   * 이미지 추가
   */
  const addImage = () => {
    const newImage: CarouselImageItem = {
      src: '',
      alt: '',
    };
    updateConfig({
      images: [...config.images, newImage],
    });
    setExpandedIndex(config.images.length);
  };

  /**
   * 이미지 삭제
   */
  const removeImage = (index: number) => {
    updateConfig({
      images: config.images.filter((_, i) => i !== index),
    });
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  /**
   * 이미지 업데이트
   */
  const updateImage = (index: number, updates: Partial<CarouselImageItem>) => {
    updateConfig({
      images: config.images.map((img, i) =>
        i === index ? { ...img, ...updates } : img
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* 이미지 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>이미지 목록</Label>
          <Button variant="outline" size="sm" onClick={addImage}>
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        </div>

        {config.images.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            이미지를 추가하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {config.images.map((image, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card"
              >
                <div
                  className="flex cursor-pointer items-center gap-2 p-3"
                  onClick={() =>
                    setExpandedIndex(expandedIndex === index ? null : index)
                  }
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">
                    {image.alt || image.src || `이미지 ${index + 1}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {expandedIndex === index && (
                  <div className="space-y-3 border-t border-border p-3">
                    {/* 이미지 업로드/URL */}
                    <ImageUploadField
                      id={`image-src-${index}`}
                      label="이미지"
                      value={image.src}
                      onChange={(url) => updateImage(index, { src: url })}
                      placeholder="https://example.com/image.jpg"
                      previewHeight={80}
                    />

                    <div className="space-y-2">
                      <Label htmlFor={`image-alt-${index}`}>대체 텍스트</Label>
                      <Input
                        id={`image-alt-${index}`}
                        placeholder="이미지 설명"
                        value={image.alt}
                        onChange={(e) =>
                          updateImage(index, { alt: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`image-link-${index}`}>
                        링크 URL (선택)
                      </Label>
                      <Input
                        id={`image-link-${index}`}
                        type="url"
                        placeholder="https://example.com"
                        value={image.linkUrl ?? ''}
                        onChange={(e) =>
                          updateImage(index, { linkUrl: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 자동 재생 */}
      <div className="flex items-center justify-between">
        <Label htmlFor="carousel-autoplay" className="cursor-pointer">
          자동 재생
        </Label>
        <Switch
          id="carousel-autoplay"
          checked={config.autoPlay}
          onCheckedChange={(checked) => updateConfig({ autoPlay: checked })}
        />
      </div>

      {/* 슬라이드 간격 */}
      {config.autoPlay && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="carousel-interval">슬라이드 간격</Label>
            <span className="text-sm text-muted-foreground">
              {config.interval / 1000}초
            </span>
          </div>
          <Slider
            id="carousel-interval"
            value={[config.interval]}
            min={1000}
            max={10000}
            step={500}
            onValueChange={([value]) => updateConfig({ interval: value })}
          />
        </div>
      )}

      {/* 도트 표시 */}
      <div className="flex items-center justify-between">
        <Label htmlFor="carousel-dots" className="cursor-pointer">
          도트 네비게이션 표시
        </Label>
        <Switch
          id="carousel-dots"
          checked={config.showDots}
          onCheckedChange={(checked) => updateConfig({ showDots: checked })}
        />
      </div>

      {/* 화살표 표시 */}
      <div className="flex items-center justify-between">
        <Label htmlFor="carousel-arrows" className="cursor-pointer">
          화살표 네비게이션 표시
        </Label>
        <Switch
          id="carousel-arrows"
          checked={config.showArrows}
          onCheckedChange={(checked) => updateConfig({ showArrows: checked })}
        />
      </div>
    </div>
  );
}
