/**
 * 티어별 제한 검증 함수 테스트
 *
 * 이 테스트는 validator 함수들의 로직만 검증합니다.
 * 실제 DB 연동은 통합 테스트에서 검증합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TIER_LIMITS, TIER_FEATURES, type Tier } from '@/lib/tier/constants';

describe('Tier Validator Logic', () => {
  describe('TIER_LIMITS Structure', () => {
    const tiers: Tier[] = ['free', 'pro', 'business'];

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
        expect(limits.maxPublishHistory).toBeGreaterThan(0);
        expect(typeof limits.maxDeployments).toBe('number');
        expect(typeof limits.monthlyPoints).toBe('number');
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

  describe('canDeploy Logic', () => {
    const checkCanDeploy = (
      tier: Tier,
      currentDeployments: number
    ) => {
      const features = TIER_FEATURES[tier];
      const limits = TIER_LIMITS[tier];

      if (!features.canDeploy) {
        return { allowed: false, reason: 'tier_not_allowed' };
      }

      if (currentDeployments >= limits.maxDeployments) {
        return { allowed: false, reason: 'deployment_limit_reached' };
      }

      return { allowed: true };
    };

    it('should not allow free tier to deploy', () => {
      const result = checkCanDeploy('free', 0);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('tier_not_allowed');
    });

    it('should allow pro tier to deploy if under limit', () => {
      const result = checkCanDeploy('pro', 0);
      expect(result.allowed).toBe(true);
    });

    it('should block pro tier when deployment limit reached', () => {
      const result = checkCanDeploy('pro', 1);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('deployment_limit_reached');
    });

    it('should allow business tier to deploy multiple', () => {
      const result = checkCanDeploy('business', 2);
      expect(result.allowed).toBe(true);
    });

    it('should block business tier when limit reached', () => {
      const result = checkCanDeploy('business', 3);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('deployment_limit_reached');
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
        30, // 30 max docs (free tier)
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
        30,
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
        30, // at limit (free tier)
        30,
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
        30,
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
        30, // at doc limit
        30,
        10, // at dataset limit
        10
      );
      expect(result.reason).toBe('storage');
    });
  });

  describe('Tier Limit Values', () => {
    it('free tier should have trial restrictions', () => {
      expect(TIER_LIMITS.free.maxChatbots).toBe(3);
      expect(TIER_LIMITS.free.maxDatasets).toBe(3);
      expect(TIER_LIMITS.free.maxTotalDocuments).toBe(30);
      expect(TIER_LIMITS.free.maxStorageBytes).toBe(100 * 1024 * 1024); // 100MB
      expect(TIER_LIMITS.free.maxDeployments).toBe(0);
      expect(TIER_LIMITS.free.monthlyPoints).toBe(0);
    });

    it('pro tier should be moderate', () => {
      expect(TIER_LIMITS.pro.maxChatbots).toBe(3);
      expect(TIER_LIMITS.pro.maxDatasets).toBe(3);
      expect(TIER_LIMITS.pro.maxTotalDocuments).toBe(100);
      expect(TIER_LIMITS.pro.maxStorageBytes).toBe(1024 * 1024 * 1024); // 1GB
      expect(TIER_LIMITS.pro.maxDeployments).toBe(1);
      expect(TIER_LIMITS.pro.monthlyPoints).toBe(3000);
    });

    it('business tier should be most generous', () => {
      expect(TIER_LIMITS.business.maxChatbots).toBe(10);
      expect(TIER_LIMITS.business.maxDatasets).toBe(10);
      expect(TIER_LIMITS.business.maxTotalDocuments).toBe(500);
      expect(TIER_LIMITS.business.maxStorageBytes).toBe(10 * 1024 * 1024 * 1024); // 10GB
      expect(TIER_LIMITS.business.maxDeployments).toBe(3);
      expect(TIER_LIMITS.business.monthlyPoints).toBe(10000);
    });

    it('limits should increase from free to business', () => {
      const tiers: Tier[] = ['free', 'pro', 'business'];
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
      const max = TIER_LIMITS.free.maxChatbots;
      const current = max - 1;
      expect(current < max).toBe(true);
    });

    it('should block at exactly max items', () => {
      const max = TIER_LIMITS.free.maxChatbots;
      const current = max;
      expect(current < max).toBe(false);
    });

    it('should calculate storage boundary correctly', () => {
      const maxStorage = TIER_LIMITS.free.maxStorageBytes;
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

  describe('Points Checking Logic', () => {
    const checkPointsAvailable = (balance: number, required: number) => ({
      allowed: balance >= required,
      balance,
      required,
      deficit: Math.max(0, required - balance),
    });

    it('should allow when balance >= required', () => {
      const result = checkPointsAvailable(100, 1);
      expect(result.allowed).toBe(true);
      expect(result.deficit).toBe(0);
    });

    it('should block when balance < required', () => {
      const result = checkPointsAvailable(0, 1);
      expect(result.allowed).toBe(false);
      expect(result.deficit).toBe(1);
    });

    it('should handle exact balance', () => {
      const result = checkPointsAvailable(1, 1);
      expect(result.allowed).toBe(true);
      expect(result.deficit).toBe(0);
    });

    it('should calculate deficit correctly', () => {
      const result = checkPointsAvailable(50, 100);
      expect(result.deficit).toBe(50);
    });
  });
});
