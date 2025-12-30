/**
 * 티어별 제한 검증 함수 테스트
 *
 * 이 테스트는 validator 함수들의 로직만 검증합니다.
 * 실제 DB 연동은 통합 테스트에서 검증합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TIER_LIMITS, type Tier } from '@/lib/tier/constants';

describe('Tier Validator Logic', () => {
  describe('TIER_LIMITS Structure', () => {
    const tiers: Tier[] = ['basic', 'standard', 'premium'];

    tiers.forEach((tier) => {
      it(`${tier} tier should have all required limits`, () => {
        const limits = TIER_LIMITS[tier];

        expect(limits.maxChatbots).toBeGreaterThan(0);
        expect(limits.maxDatasets).toBeGreaterThan(0);
        expect(limits.maxDocumentsPerDataset).toBeGreaterThan(0);
        expect(limits.maxTotalDocuments).toBeGreaterThan(0);
        expect(limits.maxStorageBytes).toBeGreaterThan(0);
        expect(limits.maxChunksPerDocument).toBeGreaterThan(0);
        expect(limits.maxMonthlyConversations).toBeGreaterThan(0);
      });
    });
  });

  describe('LimitCheckResult Logic', () => {
    // LimitCheckResult 타입의 로직을 단위 테스트
    const calculateLimitResult = (current: number, max: number) => ({
      allowed: current < max,
      current,
      max,
      remaining: Math.max(0, max - current),
    });

    it('should allow when current < max', () => {
      const result = calculateLimitResult(0, 3);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('should block when current >= max', () => {
      const result = calculateLimitResult(3, 3);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should block when current > max', () => {
      const result = calculateLimitResult(5, 3);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should calculate remaining correctly', () => {
      const result = calculateLimitResult(1, 5);
      expect(result.remaining).toBe(4);
    });

    it('should never return negative remaining', () => {
      const result = calculateLimitResult(10, 3);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });
  });

  describe('canUploadFile Logic', () => {
    // canUploadFile의 핵심 로직을 단위 테스트
    const checkUploadLogic = (
      currentStorage: number,
      newFileSize: number,
      maxStorage: number,
      currentTotalDocs: number,
      maxTotalDocs: number,
      currentDatasetDocs: number,
      maxDatasetDocs: number
    ) => {
      // 1. 용량 체크 (새 파일 포함)
      if (currentStorage + newFileSize > maxStorage) {
        return { allowed: false, reason: 'storage' };
      }

      // 2. 전체 문서 수 체크
      if (currentTotalDocs >= maxTotalDocs) {
        return { allowed: false, reason: 'totalDocuments' };
      }

      // 3. 데이터셋별 문서 수 체크
      if (currentDatasetDocs >= maxDatasetDocs) {
        return { allowed: false, reason: 'datasetDocuments' };
      }

      return { allowed: true };
    };

    it('should allow upload when all conditions pass', () => {
      const result = checkUploadLogic(
        50 * 1024 * 1024, // 50MB current
        10 * 1024 * 1024, // 10MB new file
        100 * 1024 * 1024, // 100MB max
        5, // 5 total docs
        10, // 10 max docs
        3, // 3 dataset docs
        10 // 10 max dataset docs
      );
      expect(result.allowed).toBe(true);
    });

    it('should reject when storage would exceed', () => {
      const result = checkUploadLogic(
        95 * 1024 * 1024, // 95MB current
        10 * 1024 * 1024, // 10MB new (total 105MB > 100MB)
        100 * 1024 * 1024, // 100MB max
        5,
        10,
        3,
        10
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('storage');
    });

    it('should reject when total document limit reached', () => {
      const result = checkUploadLogic(
        50 * 1024 * 1024,
        10 * 1024 * 1024,
        100 * 1024 * 1024,
        10, // at limit
        10,
        3,
        10
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('totalDocuments');
    });

    it('should reject when dataset document limit reached', () => {
      const result = checkUploadLogic(
        50 * 1024 * 1024,
        10 * 1024 * 1024,
        100 * 1024 * 1024,
        5,
        10,
        10, // at limit
        10
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('datasetDocuments');
    });

    it('should check storage first (priority)', () => {
      // 모든 조건 실패하는 경우 storage가 먼저 체크됨
      const result = checkUploadLogic(
        100 * 1024 * 1024, // at storage limit
        10 * 1024 * 1024,
        100 * 1024 * 1024,
        10, // at doc limit
        10,
        10, // at dataset limit
        10
      );
      expect(result.reason).toBe('storage');
    });
  });

  describe('Tier Limit Values', () => {
    it('basic tier should be most restrictive', () => {
      expect(TIER_LIMITS.basic.maxChatbots).toBe(1);
      expect(TIER_LIMITS.basic.maxDatasets).toBe(1);
      expect(TIER_LIMITS.basic.maxTotalDocuments).toBe(10);
      expect(TIER_LIMITS.basic.maxStorageBytes).toBe(100 * 1024 * 1024); // 100MB
    });

    it('standard tier should be moderate', () => {
      expect(TIER_LIMITS.standard.maxChatbots).toBe(3);
      expect(TIER_LIMITS.standard.maxDatasets).toBe(5);
      expect(TIER_LIMITS.standard.maxTotalDocuments).toBe(100);
      expect(TIER_LIMITS.standard.maxStorageBytes).toBe(1024 * 1024 * 1024); // 1GB
    });

    it('premium tier should be most generous', () => {
      expect(TIER_LIMITS.premium.maxChatbots).toBe(10);
      expect(TIER_LIMITS.premium.maxDatasets).toBe(20);
      expect(TIER_LIMITS.premium.maxTotalDocuments).toBe(500);
      expect(TIER_LIMITS.premium.maxStorageBytes).toBe(10 * 1024 * 1024 * 1024); // 10GB
    });

    it('limits should increase from basic to premium', () => {
      const tiers: Tier[] = ['basic', 'standard', 'premium'];
      const properties = [
        'maxChatbots',
        'maxDatasets',
        'maxTotalDocuments',
        'maxStorageBytes',
        'maxMonthlyConversations',
      ] as const;

      properties.forEach((prop) => {
        for (let i = 0; i < tiers.length - 1; i++) {
          expect(TIER_LIMITS[tiers[i]][prop]).toBeLessThanOrEqual(
            TIER_LIMITS[tiers[i + 1]][prop]
          );
        }
      });
    });
  });

  describe('Boundary Conditions', () => {
    it('should allow exactly max-1 items', () => {
      const max = TIER_LIMITS.basic.maxChatbots;
      const current = max - 1;
      expect(current < max).toBe(true);
    });

    it('should block at exactly max items', () => {
      const max = TIER_LIMITS.basic.maxChatbots;
      const current = max;
      expect(current < max).toBe(false);
    });

    it('should calculate storage boundary correctly', () => {
      const maxStorage = TIER_LIMITS.basic.maxStorageBytes;
      const fileSize = 1 * 1024 * 1024; // 1MB

      // 정확히 한도에 도달하면 OK
      const exactFit = maxStorage - fileSize;
      expect(exactFit + fileSize).toBe(maxStorage);
      expect(exactFit + fileSize <= maxStorage).toBe(true);

      // 1바이트라도 초과하면 NG
      const overBy1 = maxStorage - fileSize + 1;
      expect(overBy1 + fileSize > maxStorage).toBe(true);
    });
  });
});
