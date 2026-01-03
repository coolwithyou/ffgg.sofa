'use client';

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { useConsole } from './use-console-state';

/**
 * 발행된 버전 정보
 */
export interface PublishedVersion {
  id: string;
  publicPageConfig: unknown;
  widgetConfig: unknown;
  publishedAt: string | null;
  publishNote: string | null;
  versionNumber: number | null;
  publishedBy: string | null;
}

/**
 * 히스토리 버전 정보
 */
export interface HistoryVersion {
  id: string;
  versionNumber: number | null;
  publishedAt: string | null;
  publishNote: string | null;
  publishedBy: string | null;
}

/**
 * 버전 데이터
 */
export interface VersionsData {
  draft: {
    id: string;
    publicPageConfig: unknown;
    widgetConfig: unknown;
    updatedAt: string | null;
  } | null;
  published: PublishedVersion | null;
  history: HistoryVersion[];
}

/**
 * 버전 관리 훅 반환 값
 */
interface UseVersionsReturn {
  versions: VersionsData | null;
  hasChanges: boolean;
  isLoading: boolean;
  isPublishing: boolean;
  isReverting: boolean;
  publish: (note?: string) => Promise<void>;
  revert: () => Promise<void>;
  rollback: (versionId: string) => Promise<void>;
  refreshVersions: () => Promise<void>;
}

/**
 * 버전 관리 훅
 *
 * Draft/Published 버전을 관리하고 발행, 되돌리기, 롤백 기능을 제공합니다.
 */
export function useVersionsCore(): UseVersionsReturn {
  const { currentChatbot } = useConsole();

  const [versions, setVersions] = useState<VersionsData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  /**
   * 버전 목록 조회
   */
  const refreshVersions = useCallback(async () => {
    if (!currentChatbot?.id) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/chatbots/${currentChatbot.id}/versions`);

      if (!response.ok) {
        throw new Error('버전 조회 실패');
      }

      const data = await response.json();
      setVersions(data.versions);
      setHasChanges(data.hasChanges);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatbot?.id]);

  // 챗봇 변경 시 버전 목록 새로고침
  useEffect(() => {
    if (currentChatbot?.id) {
      refreshVersions();
    }
  }, [currentChatbot?.id, refreshVersions]);

  /**
   * 발행 (draft → published)
   */
  const publish = useCallback(
    async (note?: string) => {
      if (!currentChatbot?.id) {
        throw new Error('챗봇이 선택되지 않았습니다');
      }

      try {
        setIsPublishing(true);
        const response = await fetch(
          `/api/chatbots/${currentChatbot.id}/versions/publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note }),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || '발행 중 오류가 발생했습니다');
        }

        // 버전 목록 새로고침
        await refreshVersions();
      } finally {
        setIsPublishing(false);
      }
    },
    [currentChatbot?.id, refreshVersions]
  );

  /**
   * 되돌리기 (published → draft 복원)
   */
  const revert = useCallback(async () => {
    if (!currentChatbot?.id) {
      throw new Error('챗봇이 선택되지 않았습니다');
    }

    try {
      setIsReverting(true);
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/versions/revert`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || '되돌리기 중 오류가 발생했습니다');
      }

      // 버전 목록 새로고침
      await refreshVersions();
    } finally {
      setIsReverting(false);
    }
  }, [currentChatbot?.id, refreshVersions]);

  /**
   * 롤백 (history → draft 복원)
   */
  const rollback = useCallback(
    async (versionId: string) => {
      if (!currentChatbot?.id) {
        throw new Error('챗봇이 선택되지 않았습니다');
      }

      try {
        setIsReverting(true);
        const response = await fetch(
          `/api/chatbots/${currentChatbot.id}/versions/${versionId}/rollback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || '롤백 중 오류가 발생했습니다');
        }

        // 버전 목록 새로고침
        await refreshVersions();
      } finally {
        setIsReverting(false);
      }
    },
    [currentChatbot?.id, refreshVersions]
  );

  return {
    versions,
    hasChanges,
    isLoading,
    isPublishing,
    isReverting,
    publish,
    revert,
    rollback,
    refreshVersions,
  };
}

// ============================================
// Context 기반 싱글톤 패턴
// ============================================

const VersionsContext = createContext<UseVersionsReturn | null>(null);

/**
 * Versions Provider
 *
 * 버전 관리 로직을 단일 인스턴스로 관리합니다.
 * ConsoleShell에서 한 번만 래핑하면 됩니다.
 */
export function VersionsProvider({ children }: { children: ReactNode }) {
  const value = useVersionsCore();

  return (
    <VersionsContext.Provider value={value}>
      {children}
    </VersionsContext.Provider>
  );
}

/**
 * Versions Context 소비 훅
 *
 * 여러 컴포넌트에서 호출해도 중복 API 호출이 발생하지 않습니다.
 *
 * @throws VersionsProvider 외부에서 호출 시 에러
 */
export function useVersions(): UseVersionsReturn {
  const context = useContext(VersionsContext);
  if (!context) {
    throw new Error('useVersions must be used within VersionsProvider');
  }
  return context;
}
