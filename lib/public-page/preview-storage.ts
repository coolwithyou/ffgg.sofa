/**
 * 미리보기 데이터 LocalStorage 저장/조회 유틸리티
 *
 * 배포 전 수정사항을 미리보기하기 위해
 * 편집 중인 pageConfig를 localStorage에 임시 저장합니다.
 *
 * 키 형식: sofa_preview_{chatbotId}
 * 만료: 15분 (페이지 새로고침 시에도 유지)
 */

import type { PublicPageConfig } from './types';

const STORAGE_KEY_PREFIX = 'sofa_preview_';
const EXPIRY_MS = 15 * 60 * 1000; // 15분

interface PreviewData {
  config: PublicPageConfig;
  chatbotName: string;
  timestamp: number;
}

/**
 * 미리보기 데이터 저장
 */
export function savePreviewData(
  chatbotId: string,
  config: PublicPageConfig,
  chatbotName: string
): void {
  if (typeof window === 'undefined') return;

  const data: PreviewData = {
    config,
    chatbotName,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${chatbotId}`,
      JSON.stringify(data)
    );
  } catch (e) {
    console.error('Failed to save preview data:', e);
  }
}

/**
 * 미리보기 데이터 조회
 * 만료된 데이터는 null 반환 후 삭제
 */
export function getPreviewData(
  chatbotId: string
): PreviewData | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${chatbotId}`);
    if (!stored) return null;

    const data: PreviewData = JSON.parse(stored);

    // 만료 체크
    if (Date.now() - data.timestamp > EXPIRY_MS) {
      clearPreviewData(chatbotId);
      return null;
    }

    return data;
  } catch (e) {
    console.error('Failed to get preview data:', e);
    return null;
  }
}

/**
 * 미리보기 데이터 삭제
 */
export function clearPreviewData(chatbotId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${chatbotId}`);
  } catch (e) {
    console.error('Failed to clear preview data:', e);
  }
}

/**
 * 모든 만료된 미리보기 데이터 정리
 */
export function cleanupExpiredPreviews(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(STORAGE_KEY_PREFIX)
    );

    for (const key of keys) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data: PreviewData = JSON.parse(stored);
        if (Date.now() - data.timestamp > EXPIRY_MS) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    console.error('Failed to cleanup expired previews:', e);
  }
}
