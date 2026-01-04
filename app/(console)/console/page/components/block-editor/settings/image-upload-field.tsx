'use client';

/**
 * 이미지 업로드 필드 컴포넌트
 *
 * URL 직접 입력과 파일 업로드 두 가지 방식을 모두 지원하는
 * 재사용 가능한 이미지 입력 컴포넌트입니다.
 *
 * 사용처:
 * - ImageBlockSettings (단일 이미지)
 * - ImageCarouselSettings (캐러셀 이미지)
 * - HeaderSettings (로고 이미지) 등
 */

import { useState, useRef, useCallback } from 'react';
import { Upload, Loader2, X, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useConsole } from '@/app/(console)/console/hooks/use-console-state';
import { cn } from '@/lib/utils';

// 상수
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_QUALITY = 0.85;

interface ImageUploadFieldProps {
  /** 현재 이미지 URL */
  value: string;
  /** URL 변경 콜백 */
  onChange: (url: string) => void;
  /** 라벨 텍스트 */
  label?: string;
  /** 플레이스홀더 */
  placeholder?: string;
  /** ID (for aria-labelledby) */
  id: string;
  /** 이미지 리사이즈 최대 너비/높이 (기본 1200) */
  maxSize?: number;
  /** 이미지 품질 (0-1, 기본 0.85) */
  quality?: number;
  /** 미리보기 표시 여부 (기본 true) */
  showPreview?: boolean;
  /** 미리보기 높이 (기본 96px) */
  previewHeight?: number;
}

export function ImageUploadField({
  value,
  onChange,
  label,
  placeholder = 'https://example.com/image.jpg',
  id,
  maxSize = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
  showPreview = true,
  previewHeight = 96,
}: ImageUploadFieldProps) {
  const { currentChatbot } = useConsole();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 이미지 리사이즈 함수
   * 비율을 유지하면서 최대 크기 이내로 리사이즈
   */
  const resizeImage = useCallback(
    (file: File): Promise<{ data: string; mimeType: string }> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // 비율 유지하며 리사이즈
            if (width > maxSize || height > maxSize) {
              if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
              } else {
                width = (width / height) * maxSize;
                height = maxSize;
              }
            }

            canvas.width = Math.round(width);
            canvas.height = Math.round(height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다.'));
              return;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const mimeType = 'image/jpeg';
            const dataUrl = canvas.toDataURL(mimeType, quality);
            const base64Data = dataUrl.split(',')[1];
            resolve({ data: base64Data, mimeType });
          };
          img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
        reader.readAsDataURL(file);
      });
    },
    [maxSize, quality]
  );

  /**
   * 파일 선택 핸들러
   */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentChatbot) return;

      setError(null);
      setPreviewError(false);

      // 파일 타입 검사
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError('JPG, PNG, GIF, WebP 형식만 지원합니다.');
        return;
      }

      // 파일 크기 검사 (리사이즈 전)
      if (file.size > MAX_SIZE_BYTES * 2) {
        setError(`파일 크기가 너무 큽니다. (최대 ${MAX_SIZE_MB * 2}MB)`);
        return;
      }

      try {
        setIsUploading(true);

        // 이미지 리사이즈
        const { data, mimeType } = await resizeImage(file);

        // 서버에 업로드
        const res = await fetch(
          `/api/chatbots/${currentChatbot.id}/public-page/image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: data,
              mimeType,
              filename: file.name,
            }),
          }
        );

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || '업로드에 실패했습니다.');
        }

        onChange(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [currentChatbot, resizeImage, onChange]
  );

  /**
   * URL 삭제
   */
  const handleClear = useCallback(() => {
    onChange('');
    setPreviewError(false);
    setError(null);
  }, [onChange]);

  /**
   * URL 직접 입력
   */
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setPreviewError(false);
      setError(null);
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {label && <Label htmlFor={id}>{label}</Label>}

      {/* URL 입력 + 업로드 버튼 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type="url"
            placeholder={placeholder}
            value={value}
            onChange={handleUrlChange}
            className={cn('pr-8', error && 'border-destructive')}
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
              aria-label="이미지 URL 삭제"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="이미지 업로드"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 이미지 미리보기 */}
      {showPreview && value && (
        <div className="mt-2">
          {previewError ? (
            <div
              className="flex items-center justify-center rounded-lg border border-border bg-muted"
              style={{ height: previewHeight }}
            >
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">이미지를 불러올 수 없습니다</span>
              </div>
            </div>
          ) : (
            <img
              src={value}
              alt="미리보기"
              className="w-auto rounded-lg border border-border object-cover"
              style={{ height: previewHeight, maxWidth: '100%' }}
              onError={() => setPreviewError(true)}
            />
          )}
        </div>
      )}

      {/* 안내 문구 */}
      <p className="text-xs text-muted-foreground">
        URL을 직접 입력하거나 이미지를 업로드하세요. (JPG, PNG, GIF, WebP / 최대{' '}
        {MAX_SIZE_MB}MB)
      </p>
    </div>
  );
}
