/**
 * 티어 상수 및 유틸리티 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  TIER_LIMITS,
  TIER_NAMES,
  TIER_FEATURES,
  formatBytes,
  getTierLimitsDisplay,
  type Tier,
} from '@/lib/tier/constants';

describe('Tier Constants', () => {
  describe('TIER_LIMITS', () => {
    const tiers: Tier[] = ['free', 'pro', 'business'];

    it('should have all tier definitions', () => {
      expect(TIER_LIMITS).toHaveProperty('free');
      expect(TIER_LIMITS).toHaveProperty('pro');
      expect(TIER_LIMITS).toHaveProperty('business');
    });

    tiers.forEach((tier) => {
      describe(`${tier} tier`, () => {
        it('should have all required limit properties', () => {
          const limits = TIER_LIMITS[tier];

          expect(limits).toHaveProperty('maxChatbots');
          expect(limits).toHaveProperty('maxDatasets');
          expect(limits).toHaveProperty('maxDocumentsPerDataset');
          expect(limits).toHaveProperty('maxTotalDocuments');
          expect(limits).toHaveProperty('maxStorageBytes');
          expect(limits).toHaveProperty('maxChunksPerDocument');
          expect(limits).toHaveProperty('maxMonthlyConversations');
          expect(limits).toHaveProperty('apiRequestsPerMinute');
          expect(limits).toHaveProperty('chatRequestsPerDay');
          expect(limits).toHaveProperty('uploadRequestsPerHour');
          expect(limits).toHaveProperty('maxPublishHistory');
          expect(limits).toHaveProperty('maxDeployments');
          expect(limits).toHaveProperty('monthlyPoints');
        });

        it('should have positive numeric values for resource limits', () => {
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

    it('should have increasing limits from free to business', () => {
      // Chatbots (free와 pro는 같을 수 있음)
      expect(TIER_LIMITS.free.maxChatbots).toBeLessThanOrEqual(
        TIER_LIMITS.pro.maxChatbots
      );
      expect(TIER_LIMITS.pro.maxChatbots).toBeLessThanOrEqual(
        TIER_LIMITS.business.maxChatbots
      );

      // Datasets
      expect(TIER_LIMITS.free.maxDatasets).toBeLessThanOrEqual(
        TIER_LIMITS.pro.maxDatasets
      );
      expect(TIER_LIMITS.pro.maxDatasets).toBeLessThanOrEqual(
        TIER_LIMITS.business.maxDatasets
      );

      // Documents
      expect(TIER_LIMITS.free.maxTotalDocuments).toBeLessThanOrEqual(
        TIER_LIMITS.pro.maxTotalDocuments
      );
      expect(TIER_LIMITS.pro.maxTotalDocuments).toBeLessThanOrEqual(
        TIER_LIMITS.business.maxTotalDocuments
      );

      // Storage
      expect(TIER_LIMITS.free.maxStorageBytes).toBeLessThanOrEqual(
        TIER_LIMITS.pro.maxStorageBytes
      );
      expect(TIER_LIMITS.pro.maxStorageBytes).toBeLessThanOrEqual(
        TIER_LIMITS.business.maxStorageBytes
      );

      // Conversations
      expect(TIER_LIMITS.free.maxMonthlyConversations).toBeLessThanOrEqual(
        TIER_LIMITS.pro.maxMonthlyConversations
      );
      expect(TIER_LIMITS.pro.maxMonthlyConversations).toBeLessThanOrEqual(
        TIER_LIMITS.business.maxMonthlyConversations
      );

      // Monthly Points
      expect(TIER_LIMITS.free.monthlyPoints).toBeLessThanOrEqual(
        TIER_LIMITS.pro.monthlyPoints
      );
      expect(TIER_LIMITS.pro.monthlyPoints).toBeLessThanOrEqual(
        TIER_LIMITS.business.monthlyPoints
      );

      // Deployments
      expect(TIER_LIMITS.free.maxDeployments).toBeLessThanOrEqual(
        TIER_LIMITS.pro.maxDeployments
      );
      expect(TIER_LIMITS.pro.maxDeployments).toBeLessThanOrEqual(
        TIER_LIMITS.business.maxDeployments
      );
    });

    describe('Specific limit values', () => {
      it('free tier should have trial limits', () => {
        expect(TIER_LIMITS.free.maxChatbots).toBe(3);
        expect(TIER_LIMITS.free.maxDatasets).toBe(3);
        expect(TIER_LIMITS.free.maxTotalDocuments).toBe(30);
        expect(TIER_LIMITS.free.maxStorageBytes).toBe(100 * 1024 * 1024); // 100MB
        expect(TIER_LIMITS.free.maxDeployments).toBe(0); // No deployment
        expect(TIER_LIMITS.free.monthlyPoints).toBe(0); // No monthly points
      });

      it('pro tier should have moderate limits', () => {
        expect(TIER_LIMITS.pro.maxChatbots).toBe(3);
        expect(TIER_LIMITS.pro.maxDatasets).toBe(3);
        expect(TIER_LIMITS.pro.maxTotalDocuments).toBe(100);
        expect(TIER_LIMITS.pro.maxStorageBytes).toBe(1024 * 1024 * 1024); // 1GB
        expect(TIER_LIMITS.pro.maxDeployments).toBe(1);
        expect(TIER_LIMITS.pro.monthlyPoints).toBe(3000);
      });

      it('business tier should have high limits', () => {
        expect(TIER_LIMITS.business.maxChatbots).toBe(10);
        expect(TIER_LIMITS.business.maxDatasets).toBe(10);
        expect(TIER_LIMITS.business.maxTotalDocuments).toBe(500);
        expect(TIER_LIMITS.business.maxStorageBytes).toBe(
          10 * 1024 * 1024 * 1024
        ); // 10GB
        expect(TIER_LIMITS.business.maxDeployments).toBe(3);
        expect(TIER_LIMITS.business.monthlyPoints).toBe(10000);
      });
    });
  });

  describe('TIER_FEATURES', () => {
    it('should have feature flags for all tiers', () => {
      expect(TIER_FEATURES).toHaveProperty('free');
      expect(TIER_FEATURES).toHaveProperty('pro');
      expect(TIER_FEATURES).toHaveProperty('business');
    });

    it('free tier should not be able to deploy', () => {
      expect(TIER_FEATURES.free.canDeploy).toBe(false);
      expect(TIER_FEATURES.free.customDomain).toBe(false);
      expect(TIER_FEATURES.free.apiAccess).toBe(false);
    });

    it('pro tier should be able to deploy', () => {
      expect(TIER_FEATURES.pro.canDeploy).toBe(true);
      expect(TIER_FEATURES.pro.customDomain).toBe(false);
      expect(TIER_FEATURES.pro.apiAccess).toBe(false);
    });

    it('business tier should have all features', () => {
      expect(TIER_FEATURES.business.canDeploy).toBe(true);
      expect(TIER_FEATURES.business.customDomain).toBe(true);
      expect(TIER_FEATURES.business.apiAccess).toBe(true);
      expect(TIER_FEATURES.business.prioritySupport).toBe(true);
      expect(TIER_FEATURES.business.advancedAnalytics).toBe(true);
    });
  });

  describe('TIER_NAMES', () => {
    it('should have names for all tiers', () => {
      expect(TIER_NAMES.free).toBe('Free');
      expect(TIER_NAMES.pro).toBe('Pro');
      expect(TIER_NAMES.business).toBe('Business');
    });

    it('should have same keys as TIER_LIMITS', () => {
      const limitKeys = Object.keys(TIER_LIMITS);
      const nameKeys = Object.keys(TIER_NAMES);

      expect(nameKeys).toEqual(limitKeys);
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes correctly', () => {
      expect(formatBytes(512)).toBe('512 Bytes');
    });

    it('should format KB correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format MB correctly', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB');
    });

    it('should format GB correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10 GB');
    });

    it('should format TB correctly', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    });

    it('should handle fractional values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('getTierLimitsDisplay', () => {
    const tiers: Tier[] = ['free', 'pro', 'business'];

    tiers.forEach((tier) => {
      it(`should return display info for ${tier} tier`, () => {
        const display = getTierLimitsDisplay(tier);

        expect(display).toHaveProperty('tier', tier);
        expect(display).toHaveProperty('tierName', TIER_NAMES[tier]);
        expect(display).toHaveProperty('chatbots');
        expect(display).toHaveProperty('datasets');
        expect(display).toHaveProperty('documents');
        expect(display).toHaveProperty('storage');
        expect(display).toHaveProperty('conversations');
      });
    });

    it('should format chatbots with "최대 X개"', () => {
      const display = getTierLimitsDisplay('free');
      expect(display.chatbots).toBe('최대 3개');
    });

    it('should format datasets with "최대 X개"', () => {
      const display = getTierLimitsDisplay('pro');
      expect(display.datasets).toBe('최대 3개');
    });

    it('should format documents with "최대 X개"', () => {
      const display = getTierLimitsDisplay('business');
      expect(display.documents).toBe('최대 500개');
    });

    it('should format storage with human-readable bytes', () => {
      expect(getTierLimitsDisplay('free').storage).toBe('100 MB');
      expect(getTierLimitsDisplay('pro').storage).toBe('1 GB');
      expect(getTierLimitsDisplay('business').storage).toBe('10 GB');
    });

    it('should format conversations with "월 X회"', () => {
      const display = getTierLimitsDisplay('free');
      expect(display.conversations).toBe('월 1,000회');
    });

    it('should format large conversation numbers with locale string', () => {
      const display = getTierLimitsDisplay('business');
      expect(display.conversations).toBe('월 100,000회');
    });
  });
});
