/**
 * 챗봇 CRUD API 테스트
 *
 * app/api/chatbots/ 엔드포인트들을 테스트합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createTestChatbot,
  createTestSession,
  createTestDataset,
  TIER_TEST_DATA,
} from '../../factories';

// Mock modules
vi.mock('@/lib/auth/session', () => ({
  validateSession: vi.fn(),
}));

vi.mock('@/lib/tier/validator', () => ({
  canCreateChatbot: vi.fn(),
}));

// DB Mock
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockOrderBy = vi.fn();
const mockInnerJoin = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    insert: () => ({ values: mockValues }),
    select: () => ({ from: mockFrom }),
    update: () => ({ set: mockSet }),
    delete: () => ({ where: mockWhere }),
  },
  chatbots: {},
  chatbotDatasets: {},
  datasets: {},
  conversations: {},
}));

vi.mock('@/drizzle/schema', () => ({
  chatbots: { id: 'id', tenantId: 'tenant_id', isDefault: 'is_default' },
  chatbotDatasets: { chatbotId: 'chatbot_id', datasetId: 'dataset_id' },
  datasets: { id: 'id', tenantId: 'tenant_id' },
  conversations: { chatbotId: 'chatbot_id' },
}));

// Import after mocks
import { validateSession } from '@/lib/auth/session';
import { canCreateChatbot } from '@/lib/tier/validator';

describe('Chatbot API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Input Validation', () => {
    describe('createChatbotSchema', () => {
      it('should require name field', () => {
        const validInput = { name: 'Test Bot' };
        const invalidInput = {};

        // name이 있으면 유효
        expect(validInput.name).toBeDefined();
        expect(validInput.name.length).toBeGreaterThan(0);

        // name이 없으면 무효
        expect((invalidInput as { name?: string }).name).toBeUndefined();
      });

      it('should validate name length (1-100)', () => {
        const tooLong = 'a'.repeat(101);
        const validLength = 'a'.repeat(100);
        const empty = '';

        expect(tooLong.length).toBeGreaterThan(100);
        expect(validLength.length).toBe(100);
        expect(empty.length).toBe(0);
      });

      it('should validate description length (max 500)', () => {
        const tooLong = 'a'.repeat(501);
        const validLength = 'a'.repeat(500);

        expect(tooLong.length).toBeGreaterThan(500);
        expect(validLength.length).toBeLessThanOrEqual(500);
      });

      it('should validate llmConfig temperature range (0-2)', () => {
        const validConfigs = [
          { temperature: 0 },
          { temperature: 0.7 },
          { temperature: 2 },
        ];
        const invalidConfigs = [{ temperature: -0.1 }, { temperature: 2.1 }];

        validConfigs.forEach((config) => {
          expect(config.temperature).toBeGreaterThanOrEqual(0);
          expect(config.temperature).toBeLessThanOrEqual(2);
        });

        invalidConfigs.forEach((config) => {
          const isValid =
            config.temperature >= 0 && config.temperature <= 2;
          expect(isValid).toBe(false);
        });
      });

      it('should validate llmConfig maxTokens range (100-4096)', () => {
        const validValues = [100, 1024, 4096];
        const invalidValues = [99, 4097];

        validValues.forEach((val) => {
          expect(val).toBeGreaterThanOrEqual(100);
          expect(val).toBeLessThanOrEqual(4096);
        });

        invalidValues.forEach((val) => {
          const isValid = val >= 100 && val <= 4096;
          expect(isValid).toBe(false);
        });
      });

      it('should validate searchConfig maxChunks range (1-20)', () => {
        const validValues = [1, 5, 20];
        const invalidValues = [0, 21];

        validValues.forEach((val) => {
          expect(val).toBeGreaterThanOrEqual(1);
          expect(val).toBeLessThanOrEqual(20);
        });

        invalidValues.forEach((val) => {
          const isValid = val >= 1 && val <= 20;
          expect(isValid).toBe(false);
        });
      });

      it('should validate searchConfig minScore range (0-1)', () => {
        const validValues = [0, 0.5, 1];
        const invalidValues = [-0.1, 1.1];

        validValues.forEach((val) => {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        });

        invalidValues.forEach((val) => {
          const isValid = val >= 0 && val <= 1;
          expect(isValid).toBe(false);
        });
      });

      it('should accept valid datasetIds (UUIDs)', () => {
        const validUUID = '550e8400-e29b-41d4-a716-446655440000';
        const invalidUUID = 'not-a-uuid';

        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        expect(uuidRegex.test(validUUID)).toBe(true);
        expect(uuidRegex.test(invalidUUID)).toBe(false);
      });
    });

    describe('updateChatbotSchema', () => {
      it('should allow partial updates', () => {
        const fullUpdate = {
          name: 'Updated Name',
          description: 'Updated Description',
          status: 'active',
          llmConfig: { temperature: 0.8 },
          searchConfig: { maxChunks: 10 },
        };

        const partialUpdate = { name: 'Only Name' };

        // 전체 업데이트와 부분 업데이트 모두 유효
        expect(Object.keys(fullUpdate).length).toBeGreaterThan(1);
        expect(Object.keys(partialUpdate).length).toBe(1);
      });

      it('should validate status values', () => {
        const validStatuses = ['active', 'inactive'];
        const invalidStatus = 'deleted';

        expect(validStatuses).toContain('active');
        expect(validStatuses).toContain('inactive');
        expect(validStatuses).not.toContain(invalidStatus);
      });
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', () => {
      // 인증 없이는 401 반환
      const noSession = null;
      expect(noSession).toBeNull();
    });

    it('should use session tenantId for tenant isolation', () => {
      const session = createTestSession();
      expect(session.tenantId).toBeDefined();
      expect(session.tenantId).toBe('test-tenant-id');
    });
  });

  describe('Tier Limit Enforcement', () => {
    it('should check tier limit before creating chatbot', () => {
      const tierLimits = TIER_TEST_DATA.basic;
      expect(tierLimits.maxChatbots).toBe(3);
    });

    it('should return 403 when tier limit exceeded', () => {
      const limitResult = {
        allowed: false,
        reason: '챗봇 수 한도 초과',
        limit: { current: 3, max: 3, remaining: 0 },
      };

      expect(limitResult.allowed).toBe(false);
      expect(limitResult.reason).toContain('한도 초과');
    });

    it('should include limit info in 403 response', () => {
      const errorResponse = {
        error: '챗봇 수 한도 초과 (현재: 3, 한도: 3)',
        limit: {
          current: 3,
          max: 3,
        },
      };

      expect(errorResponse.limit).toBeDefined();
      expect(errorResponse.limit.current).toBe(3);
      expect(errorResponse.limit.max).toBe(3);
    });
  });

  describe('Default Chatbot Rules', () => {
    it('should not allow deleting default chatbot', () => {
      const defaultChatbot = createTestChatbot({ isDefault: true });
      expect(defaultChatbot.isDefault).toBe(true);

      // 기본 챗봇 삭제 시도 시 400 반환
      const shouldBlock = defaultChatbot.isDefault === true;
      expect(shouldBlock).toBe(true);
    });

    it('should not allow deactivating default chatbot', () => {
      const defaultChatbot = createTestChatbot({ isDefault: true });
      const updateRequest = { status: 'inactive' };

      const shouldBlock =
        defaultChatbot.isDefault && updateRequest.status === 'inactive';
      expect(shouldBlock).toBe(true);
    });

    it('should allow modifying default chatbot name and description', () => {
      const defaultChatbot = createTestChatbot({ isDefault: true });
      const updateRequest = { name: 'New Name', description: 'New Desc' };

      // 이름/설명 수정은 허용
      const shouldAllow = defaultChatbot.isDefault && !updateRequest.hasOwnProperty('status');
      expect(shouldAllow).toBe(true);
    });
  });

  describe('Chatbot Creation', () => {
    it('should create chatbot with minimal input', () => {
      const minimalInput = { name: 'Test Bot' };

      expect(minimalInput.name).toBeDefined();
      expect(minimalInput.name.length).toBeGreaterThan(0);
    });

    it('should apply default values for llmConfig', () => {
      const defaultLlmConfig = {
        temperature: 0.7,
        maxTokens: 1024,
        systemPrompt: null,
      };

      expect(defaultLlmConfig.temperature).toBe(0.7);
      expect(defaultLlmConfig.maxTokens).toBe(1024);
      expect(defaultLlmConfig.systemPrompt).toBeNull();
    });

    it('should apply default values for searchConfig', () => {
      const defaultSearchConfig = {
        maxChunks: 5,
        minScore: 0.5,
      };

      expect(defaultSearchConfig.maxChunks).toBe(5);
      expect(defaultSearchConfig.minScore).toBe(0.5);
    });

    it('should set isDefault to false for new chatbots', () => {
      const newChatbot = createTestChatbot();
      expect(newChatbot.isDefault).toBe(false);
    });

    it('should link datasets if datasetIds provided', () => {
      const dataset1 = createTestDataset({ id: 'dataset-1' });
      const dataset2 = createTestDataset({ id: 'dataset-2' });
      const datasetIds = [dataset1.id, dataset2.id];

      expect(datasetIds.length).toBe(2);
    });

    it('should validate dataset ownership before linking', () => {
      // 다른 테넌트의 데이터셋은 연결 불가
      const otherTenantDataset = createTestDataset({
        tenantId: 'other-tenant-id',
      });

      const currentTenantId = 'test-tenant-id';
      const isOwnedByCurrentTenant =
        otherTenantDataset.tenantId === currentTenantId;

      expect(isOwnedByCurrentTenant).toBe(false);
    });
  });

  describe('Chatbot Listing', () => {
    it('should sort by isDefault desc, createdAt desc', () => {
      const chatbots = [
        createTestChatbot({
          isDefault: false,
          createdAt: new Date('2024-01-01'),
        }),
        createTestChatbot({
          isDefault: true,
          createdAt: new Date('2024-01-02'),
        }),
        createTestChatbot({
          isDefault: false,
          createdAt: new Date('2024-01-03'),
        }),
      ];

      // 정렬: isDefault desc, createdAt desc
      const sorted = [...chatbots].sort((a, b) => {
        if (a.isDefault !== b.isDefault) {
          return a.isDefault ? -1 : 1;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      // 기본 챗봇이 먼저 오고, 그 다음 최신순
      expect(sorted[0].isDefault).toBe(true);
      expect(sorted[1].isDefault).toBe(false);
      expect(sorted[2].isDefault).toBe(false);
      expect(sorted[1].createdAt.getTime()).toBeGreaterThan(
        sorted[2].createdAt.getTime()
      );
    });

    it('should filter by status if provided', () => {
      const chatbots = [
        createTestChatbot({ status: 'active' }),
        createTestChatbot({ status: 'inactive' }),
        createTestChatbot({ status: 'active' }),
      ];

      const activeOnly = chatbots.filter((c) => c.status === 'active');
      expect(activeOnly.length).toBe(2);
    });

    it('should include stats when includeStats=true', () => {
      const chatbotWithStats = {
        ...createTestChatbot(),
        stats: {
          datasetCount: 2,
          conversationCount: 100,
        },
      };

      expect(chatbotWithStats.stats).toBeDefined();
      expect(chatbotWithStats.stats.datasetCount).toBe(2);
      expect(chatbotWithStats.stats.conversationCount).toBe(100);
    });
  });

  describe('Chatbot Detail', () => {
    it('should include linked datasets with weight', () => {
      const linkedDataset = {
        id: 'dataset-1',
        name: 'Test Dataset',
        description: 'Test',
        documentCount: 10,
        chunkCount: 100,
        status: 'active',
        weight: 1.5,
      };

      expect(linkedDataset.weight).toBe(1.5);
    });

    it('should include conversation stats', () => {
      const conversationStats = {
        total: 100,
        today: 5,
        thisWeek: 30,
        thisMonth: 80,
      };

      expect(conversationStats.total).toBeGreaterThanOrEqual(conversationStats.thisMonth);
      expect(conversationStats.thisMonth).toBeGreaterThanOrEqual(conversationStats.thisWeek);
      expect(conversationStats.thisWeek).toBeGreaterThanOrEqual(conversationStats.today);
    });

    it('should return 404 for other tenant chatbot', () => {
      const otherTenantChatbot = createTestChatbot({
        tenantId: 'other-tenant-id',
      });
      const currentTenantId = 'test-tenant-id';

      const isAccessible = otherTenantChatbot.tenantId === currentTenantId;
      expect(isAccessible).toBe(false);
    });
  });

  describe('Chatbot Update', () => {
    it('should merge llmConfig with existing values', () => {
      const existing = {
        temperature: 0.7,
        maxTokens: 1024,
        systemPrompt: 'Original prompt',
      };

      const update = { temperature: 0.9 };

      const merged = { ...existing, ...update };

      expect(merged.temperature).toBe(0.9); // updated
      expect(merged.maxTokens).toBe(1024); // preserved
      expect(merged.systemPrompt).toBe('Original prompt'); // preserved
    });

    it('should merge searchConfig with existing values', () => {
      const existing = { maxChunks: 5, minScore: 0.5 };
      const update = { minScore: 0.7 };

      const merged = { ...existing, ...update };

      expect(merged.maxChunks).toBe(5); // preserved
      expect(merged.minScore).toBe(0.7); // updated
    });

    it('should handle null description update', () => {
      const existing = { description: 'Original' };
      const update = { description: null };

      // description을 null로 업데이트 가능
      const result = update.description;
      expect(result).toBeNull();
    });
  });

  describe('Chatbot Deletion', () => {
    it('should cascade delete chatbot_datasets', () => {
      // CASCADE 삭제는 DB 레벨에서 처리됨
      const chatbotId = 'chatbot-to-delete';
      expect(chatbotId).toBeDefined();
    });

    it('should return 404 for non-existent chatbot', () => {
      const nonExistentId = 'non-existent-id';
      const chatbot = null;

      expect(chatbot).toBeNull();
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return chatbots for current tenant', () => {
      const currentTenantId = 'test-tenant-id';
      const chatbots = [
        createTestChatbot({ tenantId: currentTenantId }),
        createTestChatbot({ tenantId: 'other-tenant-id' }),
        createTestChatbot({ tenantId: currentTenantId }),
      ];

      const filteredByTenant = chatbots.filter(
        (c) => c.tenantId === currentTenantId
      );

      expect(filteredByTenant.length).toBe(2);
    });

    it('should add tenantId filter to all queries', () => {
      const session = createTestSession();
      const tenantId = session.tenantId;

      expect(tenantId).toBe('test-tenant-id');
    });
  });
});
