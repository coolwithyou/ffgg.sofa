/**
 * 티어 상수 및 유틸리티 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  TIER_LIMITS,
  TIER_NAMES,
  formatBytes,
  getTierLimitsDisplay,
  type Tier,
} from '@/lib/tier/constants';

describe('Tier Constants', () => {
  describe('TIER_LIMITS', () => {
    const tiers: Tier[] = ['basic', 'standard', 'premium'];

    it('should have all tier definitions', () => {
      expect(TIER_LIMITS).toHaveProperty('basic');
      expect(TIER_LIMITS).toHaveProperty('standard');
      expect(TIER_LIMITS).toHaveProperty('premium');
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
        });

        it('should have positive numeric values', () => {
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

    it('should have increasing limits from basic to premium', () => {
      // Chatbots
      expect(TIER_LIMITS.basic.maxChatbots).toBeLessThanOrEqual(
        TIER_LIMITS.standard.maxChatbots
      );
      expect(TIER_LIMITS.standard.maxChatbots).toBeLessThanOrEqual(
        TIER_LIMITS.premium.maxChatbots
      );

      // Datasets
      expect(TIER_LIMITS.basic.maxDatasets).toBeLessThanOrEqual(
        TIER_LIMITS.standard.maxDatasets
      );
      expect(TIER_LIMITS.standard.maxDatasets).toBeLessThanOrEqual(
        TIER_LIMITS.premium.maxDatasets
      );

      // Documents
      expect(TIER_LIMITS.basic.maxTotalDocuments).toBeLessThanOrEqual(
        TIER_LIMITS.standard.maxTotalDocuments
      );
      expect(TIER_LIMITS.standard.maxTotalDocuments).toBeLessThanOrEqual(
        TIER_LIMITS.premium.maxTotalDocuments
      );

      // Storage
      expect(TIER_LIMITS.basic.maxStorageBytes).toBeLessThanOrEqual(
        TIER_LIMITS.standard.maxStorageBytes
      );
      expect(TIER_LIMITS.standard.maxStorageBytes).toBeLessThanOrEqual(
        TIER_LIMITS.premium.maxStorageBytes
      );

      // Conversations
      expect(TIER_LIMITS.basic.maxMonthlyConversations).toBeLessThanOrEqual(
        TIER_LIMITS.standard.maxMonthlyConversations
      );
      expect(TIER_LIMITS.standard.maxMonthlyConversations).toBeLessThanOrEqual(
        TIER_LIMITS.premium.maxMonthlyConversations
      );
    });

    describe('Specific limit values', () => {
      it('basic tier should have minimal limits', () => {
        expect(TIER_LIMITS.basic.maxChatbots).toBe(1);
        expect(TIER_LIMITS.basic.maxDatasets).toBe(1);
        expect(TIER_LIMITS.basic.maxTotalDocuments).toBe(10);
        expect(TIER_LIMITS.basic.maxStorageBytes).toBe(100 * 1024 * 1024); // 100MB
      });

      it('standard tier should have moderate limits', () => {
        expect(TIER_LIMITS.standard.maxChatbots).toBe(3);
        expect(TIER_LIMITS.standard.maxDatasets).toBe(5);
        expect(TIER_LIMITS.standard.maxTotalDocuments).toBe(100);
        expect(TIER_LIMITS.standard.maxStorageBytes).toBe(1024 * 1024 * 1024); // 1GB
      });

      it('premium tier should have high limits', () => {
        expect(TIER_LIMITS.premium.maxChatbots).toBe(10);
        expect(TIER_LIMITS.premium.maxDatasets).toBe(20);
        expect(TIER_LIMITS.premium.maxTotalDocuments).toBe(500);
        expect(TIER_LIMITS.premium.maxStorageBytes).toBe(
          10 * 1024 * 1024 * 1024
        ); // 10GB
      });
    });
  });

  describe('TIER_NAMES', () => {
    it('should have Korean names for all tiers', () => {
      expect(TIER_NAMES.basic).toBe('베이직');
      expect(TIER_NAMES.standard).toBe('스탠다드');
      expect(TIER_NAMES.premium).toBe('프리미엄');
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
    const tiers: Tier[] = ['basic', 'standard', 'premium'];

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
      const display = getTierLimitsDisplay('basic');
      expect(display.chatbots).toBe('최대 1개');
    });

    it('should format datasets with "최대 X개"', () => {
      const display = getTierLimitsDisplay('standard');
      expect(display.datasets).toBe('최대 5개');
    });

    it('should format documents with "최대 X개"', () => {
      const display = getTierLimitsDisplay('premium');
      expect(display.documents).toBe('최대 500개');
    });

    it('should format storage with human-readable bytes', () => {
      expect(getTierLimitsDisplay('basic').storage).toBe('100 MB');
      expect(getTierLimitsDisplay('standard').storage).toBe('1 GB');
      expect(getTierLimitsDisplay('premium').storage).toBe('10 GB');
    });

    it('should format conversations with "월 X회"', () => {
      const display = getTierLimitsDisplay('basic');
      expect(display.conversations).toBe('월 1,000회');
    });

    it('should format large conversation numbers with locale string', () => {
      const display = getTierLimitsDisplay('premium');
      expect(display.conversations).toBe('월 100,000회');
    });
  });
});
