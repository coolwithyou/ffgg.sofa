'use client';

/**
 * 프로필 이미지 업로드 컴포넌트
 * Phase 3.3: 이미지 업로드, 미리보기, 삭제
 */

import { useState, useRef } from 'react';

interface AvatarUploadProps {
  currentAvatar: string | null;
  userName?: string;
  onUpdate?: (newAvatarUrl: string | null) => void;
}

const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const TARGET_SIZE = 200; // 리사이즈 목표 크기

export default function AvatarUpload({
  currentAvatar,
  userName,
  onUpdate,
}: AvatarUploadProps) {
  const [avatar, setAvatar] = useState<string | null>(currentAvatar);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이니셜 생성
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // 이미지 리사이즈
  const resizeImage = (
    file: File,
    maxSize: number
  ): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 정사각형으로 크롭 (중앙 기준)
          const size = Math.min(width, height);
          const offsetX = (width - size) / 2;
          const offsetY = (height - size) / 2;

          canvas.width = maxSize;
          canvas.height = maxSize;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 컨텍스트를 생성할 수 없습니다.'));
            return;
          }

          // 정사각형 크롭 후 리사이즈
          ctx.drawImage(
            img,
            offsetX,
            offsetY,
            size,
            size,
            0,
            0,
            maxSize,
            maxSize
          );

          // 품질 조절 (JPEG: 0.8)
          const mimeType = 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, 0.8);
          const base64Data = dataUrl.split(',')[1];

          resolve({ data: base64Data, mimeType });
        };
        img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);

    // 파일 타입 검사
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 검사 (원본)
    if (file.size > MAX_SIZE_BYTES * 2) {
      // 리사이즈 고려해서 여유있게
      setError(`파일 크기가 너무 큽니다. (최대 ${MAX_SIZE_MB * 2}MB)`);
      return;
    }

    try {
      setIsLoading(true);

      // 이미지 리사이즈
      const { data, mimeType } = await resizeImage(file, TARGET_SIZE);

      // 서버에 업로드
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: data, mimeType }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || '업로드에 실패했습니다.');
      }

      setAvatar(result.avatarUrl);
      setMessage('프로필 이미지가 업데이트되었습니다.');
      onUpdate?.(result.avatarUrl);

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setIsLoading(false);
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!avatar) return;

    setError(null);
    setMessage(null);

    try {
      setIsLoading(true);

      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || '삭제에 실패했습니다.');
      }

      setAvatar(null);
      setMessage('프로필 이미지가 삭제되었습니다.');
      onUpdate?.(null);

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium text-muted-foreground">
        프로필 이미지
      </label>

      <div className="flex items-center gap-4">
        {/* 아바타 미리보기 */}
        <div className="relative">
          {avatar ? (
            <img
              src={avatar}
              alt="프로필 이미지"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary ring-2 ring-border">
              {getInitials(userName)}
            </div>
          )}

          {/* 로딩 오버레이 */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/80">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>

        {/* 버튼 그룹 */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isLoading}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {avatar ? '이미지 변경' : '이미지 업로드'}
          </button>

          {avatar && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* 안내 문구 */}
      <p className="text-xs text-muted-foreground">
        JPG, PNG, GIF, WebP 형식. 최대 {MAX_SIZE_MB}MB. 200x200px로 자동
        리사이즈됩니다.
      </p>

      {/* 메시지 */}
      {message && (
        <p className="text-sm text-green-500">{message}</p>
      )}

      {/* 에러 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
