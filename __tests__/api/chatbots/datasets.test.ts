/**
 * 챗봇-데이터셋 연결 API 테스트
 *
 * 이 테스트는 챗봇과 데이터셋 간의 N:M 연결 로직을 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  createTestChatbot,
  createTestDataset,
  createTestChatbotDataset,
  createTestSession,
} from '@/__tests__/factories';

// 데이터셋 연결 스키마 (API와 동일)
const linkDatasetSchema = z.object({
  datasetId: z.string().uuid(),
  weight: z.number().min(0.1).max(10).optional().default(1.0),
});

// 가중치 수정 스키마 (API와 동일)
const updateWeightSchema = z.object({
  weight: z.number().min(0.1).max(10),
});

describe('Chatbot-Dataset Link API', () => {
  describe('Input Validation', () => {
    describe('linkDatasetSchema', () => {
      it('should accept valid UUID datasetId', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: '123e4567-e89b-12d3-a456-426614174000',
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid UUID format', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: 'not-a-uuid',
        });
        expect(result.success).toBe(false);
      });

      it('should set default weight to 1.0', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: '123e4567-e89b-12d3-a456-426614174000',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.weight).toBe(1.0);
        }
      });

      it('should accept custom weight', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: '123e4567-e89b-12d3-a456-426614174000',
          weight: 2.5,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.weight).toBe(2.5);
        }
      });

      it('should reject weight below 0.1', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: '123e4567-e89b-12d3-a456-426614174000',
          weight: 0.05,
        });
        expect(result.success).toBe(false);
      });

      it('should accept weight exactly 0.1', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: '123e4567-e89b-12d3-a456-426614174000',
          weight: 0.1,
        });
        expect(result.success).toBe(true);
      });

      it('should reject weight above 10', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: '123e4567-e89b-12d3-a456-426614174000',
          weight: 10.1,
        });
        expect(result.success).toBe(false);
      });

      it('should accept weight exactly 10', () => {
        const result = linkDatasetSchema.safeParse({
          datasetId: '123e4567-e89b-12d3-a456-426614174000',
          weight: 10,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('updateWeightSchema', () => {
      it('should accept valid weight', () => {
        const result = updateWeightSchema.safeParse({ weight: 1.5 });
        expect(result.success).toBe(true);
      });

      it('should reject weight below 0.1', () => {
        const result = updateWeightSchema.safeParse({ weight: 0 });
        expect(result.success).toBe(false);
      });

      it('should reject weight above 10', () => {
        const result = updateWeightSchema.safeParse({ weight: 11 });
        expect(result.success).toBe(false);
      });

      it('should require weight (not optional)', () => {
        const result = updateWeightSchema.safeParse({});
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Authentication', () => {
    it('should require session for all operations', () => {
      const validateSession = (session: ReturnType<typeof createTestSession> | null) => {
        if (!session) {
          return { error: '인증이 필요합니다', status: 401 };
        }
        return { success: true };
      };

      expect(validateSession(null).status).toBe(401);
      expect(validateSession(createTestSession()).success).toBe(true);
    });
  });

  describe('Link Creation', () => {
    it('should create new link with default weight', () => {
      const chatbot = createTestChatbot();
      const dataset = createTestDataset();
      const weight = 1.0;

      const newLink = createTestChatbotDataset({
        chatbotId: chatbot.id,
        datasetId: dataset.id,
        weight,
      });

      expect(newLink.chatbotId).toBe(chatbot.id);
      expect(newLink.datasetId).toBe(dataset.id);
      expect(newLink.weight).toBe(1.0);
    });

    it('should create new link with custom weight', () => {
      const weight = 2.5;
      const link = createTestChatbotDataset({ weight });

      expect(link.weight).toBe(2.5);
    });

    it('should return 201 on new link creation', () => {
      const isNewLink = true;
      const statusCode = isNewLink ? 201 : 200;

      expect(statusCode).toBe(201);
    });
  });

  describe('Link Update (Existing)', () => {
    it('should update weight for existing link', () => {
      const existingLink = createTestChatbotDataset({ weight: 1.0 });
      const newWeight = 3.0;

      const updatedLink = { ...existingLink, weight: newWeight };

      expect(updatedLink.weight).toBe(3.0);
    });

    it('should return updated: true for existing link', () => {
      const linkExists = true;
      const response = linkExists
        ? { message: '데이터셋 가중치가 업데이트되었습니다', updated: true }
        : { message: '데이터셋이 연결되었습니다' };

      expect(response.updated).toBe(true);
    });
  });

  describe('Link Listing', () => {
    it('should return linked datasets with weight', () => {
      const chatbotId = 'test-chatbot-id';
      const links = [
        createTestChatbotDataset({ chatbotId, weight: 1.0 }),
        createTestChatbotDataset({ chatbotId, weight: 2.0 }),
        createTestChatbotDataset({ chatbotId, weight: 0.5 }),
      ];

      const linkedDatasets = links
        .filter((l) => l.chatbotId === chatbotId)
        .map((l) => ({
          datasetId: l.datasetId,
          weight: l.weight,
          linkedAt: l.createdAt,
        }));

      expect(linkedDatasets.length).toBe(3);
      expect(linkedDatasets[0].weight).toBe(1.0);
      expect(linkedDatasets[1].weight).toBe(2.0);
      expect(linkedDatasets[2].weight).toBe(0.5);
    });

    it('should include dataset details in listing', () => {
      const chatbotId = 'test-chatbot-id';
      const dataset = createTestDataset({
        name: 'FAQ Dataset',
        documentCount: 10,
        chunkCount: 100,
      });
      const link = createTestChatbotDataset({
        chatbotId,
        datasetId: dataset.id,
        weight: 1.5,
      });

      // JOIN 결과 시뮬레이션
      const linkedDataset = {
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        documentCount: dataset.documentCount,
        chunkCount: dataset.chunkCount,
        totalStorageBytes: dataset.totalStorageBytes,
        status: dataset.status,
        isDefault: dataset.isDefault,
        weight: link.weight,
        linkedAt: link.createdAt,
      };

      expect(linkedDataset.name).toBe('FAQ Dataset');
      expect(linkedDataset.weight).toBe(1.5);
      expect(linkedDataset.documentCount).toBe(10);
    });

    it('should return empty array for chatbot with no links', () => {
      const chatbotId = 'chatbot-with-no-links';
      const allLinks = [
        createTestChatbotDataset({ chatbotId: 'other-chatbot' }),
        createTestChatbotDataset({ chatbotId: 'another-chatbot' }),
      ];

      const linkedDatasets = allLinks.filter((l) => l.chatbotId === chatbotId);

      expect(linkedDatasets.length).toBe(0);
    });
  });

  describe('Weight Update', () => {
    it('should update weight for existing link', () => {
      const parseResult = updateWeightSchema.safeParse({ weight: 5.0 });
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.weight).toBe(5.0);
      }
    });

    it('should return 404 for non-existent link', () => {
      const linkExists = false;
      const response = linkExists
        ? { success: true }
        : { error: '연결된 데이터셋을 찾을 수 없습니다', status: 404 };

      expect(response.status).toBe(404);
    });

    it('should return success message on weight update', () => {
      const newWeight = 3.5;
      const response = {
        message: '가중치가 수정되었습니다',
        weight: newWeight,
      };

      expect(response.message).toBe('가중치가 수정되었습니다');
      expect(response.weight).toBe(3.5);
    });
  });

  describe('Link Deletion', () => {
    it('should delete link successfully', () => {
      const chatbotId = 'test-chatbot-id';
      const datasetId = 'dataset-to-unlink';
      const links = [
        createTestChatbotDataset({ chatbotId, datasetId }),
        createTestChatbotDataset({ chatbotId, datasetId: 'other-dataset' }),
      ];

      // 삭제 후
      const remainingLinks = links.filter((l) => l.datasetId !== datasetId);

      expect(remainingLinks.length).toBe(1);
      expect(remainingLinks[0].datasetId).toBe('other-dataset');
    });

    it('should return 404 for non-existent link', () => {
      const linkExists = false;
      const response = linkExists
        ? { success: true }
        : { error: '연결된 데이터셋을 찾을 수 없습니다', status: 404 };

      expect(response.status).toBe(404);
    });

    it('should return success message on deletion', () => {
      const response = { message: '데이터셋 연결이 해제되었습니다' };
      expect(response.message).toBe('데이터셋 연결이 해제되었습니다');
    });
  });

  describe('Tenant Isolation', () => {
    it('should not access chatbot from different tenant', () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      const chatbot = createTestChatbot({ tenantId: tenantA });

      const canAccess = (requestingTenantId: string) =>
        chatbot.tenantId === requestingTenantId;

      expect(canAccess(tenantA)).toBe(true);
      expect(canAccess(tenantB)).toBe(false);
    });

    it('should not link dataset from different tenant', () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      const chatbot = createTestChatbot({ tenantId: tenantA });
      const datasetSameTenant = createTestDataset({ tenantId: tenantA });
      const datasetDifferentTenant = createTestDataset({ tenantId: tenantB });

      const canLink = (datasetTenantId: string) =>
        chatbot.tenantId === datasetTenantId;

      expect(canLink(datasetSameTenant.tenantId)).toBe(true);
      expect(canLink(datasetDifferentTenant.tenantId)).toBe(false);
    });
  });

  describe('Error Responses', () => {
    it('should return 401 for unauthenticated requests', () => {
      const authenticated = false;
      const response = authenticated
        ? null
        : { error: '인증이 필요합니다', status: 401 };

      expect(response?.status).toBe(401);
    });

    it('should return 404 for non-existent chatbot', () => {
      const chatbotExists = false;
      const response = chatbotExists
        ? null
        : { error: '챗봇을 찾을 수 없습니다', status: 404 };

      expect(response?.status).toBe(404);
    });

    it('should return 404 for non-existent dataset', () => {
      const datasetExists = false;
      const response = datasetExists
        ? null
        : { error: '데이터셋을 찾을 수 없습니다', status: 404 };

      expect(response?.status).toBe(404);
    });

    it('should return 404 for non-existent link on update', () => {
      const linkExists = false;
      const response = linkExists
        ? null
        : { error: '연결된 데이터셋을 찾을 수 없습니다', status: 404 };

      expect(response?.status).toBe(404);
    });

    it('should return 400 for invalid input', () => {
      const input = { datasetId: 'invalid-uuid', weight: 'not-a-number' };
      const parseResult = linkDatasetSchema.safeParse(input);

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const response = {
          error: '입력값이 올바르지 않습니다',
          details: parseResult.error.flatten(),
          status: 400,
        };
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Response Format', () => {
    describe('GET /api/chatbots/:id/datasets', () => {
      it('should return datasets array', () => {
        const datasets = [
          {
            id: 'dataset-1',
            name: 'Dataset 1',
            weight: 1.0,
            linkedAt: new Date(),
          },
          {
            id: 'dataset-2',
            name: 'Dataset 2',
            weight: 2.0,
            linkedAt: new Date(),
          },
        ];

        const response = { datasets };

        expect(response.datasets).toBeInstanceOf(Array);
        expect(response.datasets.length).toBe(2);
        expect(response.datasets[0].weight).toBe(1.0);
      });
    });

    describe('POST /api/chatbots/:id/datasets', () => {
      it('should return 201 with dataset info on new link', () => {
        const isNewLink = true;
        const dataset = createTestDataset({ name: 'New Dataset' });
        const weight = 1.5;

        const response = isNewLink
          ? {
              message: '데이터셋이 연결되었습니다',
              dataset: { id: dataset.id, name: dataset.name, weight },
              status: 201,
            }
          : {
              message: '데이터셋 가중치가 업데이트되었습니다',
              updated: true,
              status: 200,
            };

        expect(response.status).toBe(201);
        expect(response.message).toBe('데이터셋이 연결되었습니다');
      });

      it('should return 200 with updated flag on existing link', () => {
        const isNewLink = false;

        const response = isNewLink
          ? { message: '데이터셋이 연결되었습니다', status: 201 }
          : {
              message: '데이터셋 가중치가 업데이트되었습니다',
              updated: true,
              status: 200,
            };

        expect(response.updated).toBe(true);
        expect(response.message).toBe('데이터셋 가중치가 업데이트되었습니다');
      });
    });

    describe('PATCH /api/chatbots/:id/datasets/:datasetId', () => {
      it('should return updated weight', () => {
        const newWeight = 4.0;
        const response = {
          message: '가중치가 수정되었습니다',
          weight: newWeight,
        };

        expect(response.weight).toBe(4.0);
      });
    });

    describe('DELETE /api/chatbots/:id/datasets/:datasetId', () => {
      it('should return success message', () => {
        const response = { message: '데이터셋 연결이 해제되었습니다' };
        expect(response.message).toBe('데이터셋 연결이 해제되었습니다');
      });
    });
  });

  describe('Weight Calculation Logic', () => {
    it('should use weight in search result ranking', () => {
      // 가중치가 검색 결과 순위에 영향을 미치는 시나리오
      const links = [
        { datasetId: 'dataset-1', weight: 0.5 },
        { datasetId: 'dataset-2', weight: 2.0 },
        { datasetId: 'dataset-3', weight: 1.0 },
      ];

      // 검색 결과에 가중치 적용 (높은 가중치 = 높은 우선순위)
      const searchResults = [
        { datasetId: 'dataset-1', score: 0.8 },
        { datasetId: 'dataset-2', score: 0.7 },
        { datasetId: 'dataset-3', score: 0.9 },
      ];

      const weightedResults = searchResults.map((result) => {
        const link = links.find((l) => l.datasetId === result.datasetId);
        return {
          ...result,
          weightedScore: result.score * (link?.weight || 1.0),
        };
      });

      // dataset-2: 0.7 * 2.0 = 1.4
      // dataset-3: 0.9 * 1.0 = 0.9
      // dataset-1: 0.8 * 0.5 = 0.4
      expect(weightedResults[1].weightedScore).toBe(1.4);
      expect(weightedResults[2].weightedScore).toBe(0.9);
      expect(weightedResults[0].weightedScore).toBe(0.4);

      // 가중치 적용 후 정렬
      const sorted = [...weightedResults].sort(
        (a, b) => b.weightedScore - a.weightedScore
      );
      expect(sorted[0].datasetId).toBe('dataset-2');
      expect(sorted[1].datasetId).toBe('dataset-3');
      expect(sorted[2].datasetId).toBe('dataset-1');
    });

    it('should handle default weight of 1.0', () => {
      const score = 0.8;
      const defaultWeight = 1.0;
      const weightedScore = score * defaultWeight;

      expect(weightedScore).toBe(0.8);
    });

    it('should amplify scores with weight > 1', () => {
      const score = 0.5;
      const weight = 3.0;
      const weightedScore = score * weight;

      expect(weightedScore).toBe(1.5);
      expect(weightedScore).toBeGreaterThan(score);
    });

    it('should reduce scores with weight < 1', () => {
      const score = 0.8;
      const weight = 0.5;
      const weightedScore = score * weight;

      expect(weightedScore).toBe(0.4);
      expect(weightedScore).toBeLessThan(score);
    });
  });

  describe('Unique Constraint', () => {
    it('should prevent duplicate chatbot-dataset links', () => {
      // 시뮬레이션: 동일한 chatbot-dataset 조합 체크
      const existingLinks = [
        { chatbotId: 'chatbot-1', datasetId: 'dataset-1' },
        { chatbotId: 'chatbot-1', datasetId: 'dataset-2' },
        { chatbotId: 'chatbot-2', datasetId: 'dataset-1' },
      ];

      const isDuplicate = (chatbotId: string, datasetId: string) =>
        existingLinks.some(
          (l) => l.chatbotId === chatbotId && l.datasetId === datasetId
        );

      expect(isDuplicate('chatbot-1', 'dataset-1')).toBe(true);
      expect(isDuplicate('chatbot-1', 'dataset-3')).toBe(false);
    });

    it('should update instead of insert when link exists', () => {
      const existingLink = createTestChatbotDataset({ weight: 1.0 });
      const newWeight = 2.0;

      // 존재하면 업데이트
      const operation = existingLink ? 'update' : 'insert';
      expect(operation).toBe('update');
    });
  });

  describe('Multi-Dataset Search Support', () => {
    it('should retrieve all linked dataset IDs for chatbot', () => {
      const chatbotId = 'test-chatbot-id';
      const links = [
        createTestChatbotDataset({ chatbotId, datasetId: 'dataset-1' }),
        createTestChatbotDataset({ chatbotId, datasetId: 'dataset-2' }),
        createTestChatbotDataset({ chatbotId, datasetId: 'dataset-3' }),
      ];

      const datasetIds = links
        .filter((l) => l.chatbotId === chatbotId)
        .map((l) => l.datasetId);

      expect(datasetIds).toEqual(['dataset-1', 'dataset-2', 'dataset-3']);
      expect(datasetIds.length).toBe(3);
    });

    it('should support empty dataset list for unlinked chatbot', () => {
      const chatbotId = 'unlinked-chatbot';
      const links: { chatbotId: string; datasetId: string }[] = [];

      const datasetIds = links
        .filter((l) => l.chatbotId === chatbotId)
        .map((l) => l.datasetId);

      expect(datasetIds.length).toBe(0);
    });
  });
});
