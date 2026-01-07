'use client';

import { create } from 'zustand';
import { LOW_POINTS_THRESHOLD } from '@/lib/points/constants';

/**
 * 포인트 데이터 인터페이스 (/api/points 응답 형식)
 */
export interface PointsData {
  balance: {
    balance: number;
    monthlyPointsBase: number;
    isLow: boolean;
  };
  monthlyUsage: {
    used: number;
    transactionCount: number;
  };
}

/**
 * 포인트 스토어 상태 인터페이스
 */
interface PointsState {
  // 상태
  balance: number | null;
  monthlyPointsBase: number;
  monthlyUsed: number;
  transactionCount: number;
  isLow: boolean;
  isLoading: boolean;
  error: boolean;
  lastUpdated: Date | null;

  // 액션
  setPoints: (data: PointsData) => void;
  decrementPoints: (amount?: number) => void;
  incrementMonthlyUsed: (amount?: number) => void;
  syncFromServer: (newBalance: number) => void;
  fetchPoints: () => Promise<void>;
  reset: () => void;
}

/**
 * Zustand 포인트 스토어
 *
 * 실시간 포인트 업데이트를 위한 전역 상태 관리
 * - 낙관적 업데이트: decrementPoints()로 즉시 차감 표시
 * - 서버 동기화: syncFromServer()로 정확한 잔액 반영
 * - 백그라운드 폴링: fetchPoints()로 주기적 갱신
 */
export const usePointsStore = create<PointsState>((set, get) => ({
  // 초기 상태
  balance: null,
  monthlyPointsBase: 0,
  monthlyUsed: 0,
  transactionCount: 0,
  isLow: false,
  isLoading: true,
  error: false,
  lastUpdated: null,

  /**
   * API 응답 데이터로 전체 상태 설정
   */
  setPoints: (data: PointsData) => {
    set({
      balance: data.balance.balance,
      monthlyPointsBase: data.balance.monthlyPointsBase,
      monthlyUsed: data.monthlyUsage.used,
      transactionCount: data.monthlyUsage.transactionCount,
      isLow: data.balance.balance <= LOW_POINTS_THRESHOLD,
      isLoading: false,
      error: false,
      lastUpdated: new Date(),
    });
  },

  /**
   * 낙관적 업데이트: 포인트 즉시 차감 (UI 반영)
   * 채팅 전송 시 호출하여 즉각적인 피드백 제공
   */
  decrementPoints: (amount = 1) => {
    const { balance } = get();
    if (balance === null) return;

    const newBalance = Math.max(0, balance - amount);
    set({
      balance: newBalance,
      isLow: newBalance <= LOW_POINTS_THRESHOLD,
    });
  },

  /**
   * 월간 사용량 증가 (낙관적 업데이트용)
   */
  incrementMonthlyUsed: (amount = 1) => {
    const { monthlyUsed, transactionCount } = get();
    set({
      monthlyUsed: monthlyUsed + amount,
      transactionCount: transactionCount + 1,
    });
  },

  /**
   * 서버 응답으로 잔액 동기화
   * 채팅 응답에서 반환된 정확한 잔액으로 보정
   */
  syncFromServer: (newBalance: number) => {
    set({
      balance: newBalance,
      isLow: newBalance <= LOW_POINTS_THRESHOLD,
      lastUpdated: new Date(),
    });
  },

  /**
   * API에서 포인트 정보 조회
   * 초기 로드 및 백그라운드 폴링에 사용
   */
  fetchPoints: async () => {
    try {
      const res = await fetch('/api/points');
      if (!res.ok) throw new Error('Failed to fetch');
      const data: PointsData = await res.json();
      get().setPoints(data);
    } catch {
      set({ error: true, isLoading: false });
    }
  },

  /**
   * 상태 초기화 (로그아웃 시 등)
   */
  reset: () => {
    set({
      balance: null,
      monthlyPointsBase: 0,
      monthlyUsed: 0,
      transactionCount: 0,
      isLow: false,
      isLoading: true,
      error: false,
      lastUpdated: null,
    });
  },
}));

/**
 * 포인트 스토어 선택자 (최적화용)
 * 필요한 상태만 구독하여 불필요한 리렌더링 방지
 */
export const selectPointsBalance = (state: PointsState) => state.balance;
export const selectIsLow = (state: PointsState) => state.isLow;
export const selectMonthlyUsage = (state: PointsState) => ({
  used: state.monthlyUsed,
  transactionCount: state.transactionCount,
});
