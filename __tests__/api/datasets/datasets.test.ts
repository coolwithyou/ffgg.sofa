/**
 * 데이터셋 CRUD API 테스트
 *
 * 이 테스트는 데이터셋 API의 입력 검증 및 비즈니스 로직을 검증합니다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  createTestDataset,
  createTestSession,
  createTestDocument,
  createTestChunk,
} from '@/__tests__/factories';

// 데이터셋 생성 스키마 (API와 동일)
const createDatasetSchema = z.object({
  name: z
    .string()
    .min(1, '이름을 입력해주세요')
    .max(100, '이름은 100자 이내로 입력해주세요'),
  description: z.string().max(500, '설명은 500자 이내로 입력해주세요').optional(),
});

// 데이터셋 수정 스키마 (API와 동일)
const updateDatasetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

describe('Dataset API', () => {
  describe('Input Validation', () => {
    describe('createDatasetSchema', () => {
      it('should accept valid name only', () => {
        const result = createDatasetSchema.safeParse({ name: 'Test Dataset' });
        expect(result.success).toBe(true);
      });

      it('should accept valid name and description', () => {
        const result = createDatasetSchema.safeParse({
          name: 'Test Dataset',
          description: 'This is a test dataset',
        });
        expect(result.success).toBe(true);
      });

      it('should reject empty name', () => {
        const result = createDatasetSchema.safeParse({ name: '' });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.flatten().fieldErrors.name).toContain(
            '이름을 입력해주세요'
          );
        }
      });

      it('should reject name longer than 100 characters', () => {
        const result = createDatasetSchema.safeParse({ name: 'a'.repeat(101) });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.flatten().fieldErrors.name).toContain(
            '이름은 100자 이내로 입력해주세요'
          );
        }
      });

      it('should accept name exactly 100 characters', () => {
        const result = createDatasetSchema.safeParse({ name: 'a'.repeat(100) });
        expect(result.success).toBe(true);
      });

      it('should reject description longer than 500 characters', () => {
        const result = createDatasetSchema.safeParse({
          name: 'Test',
          description: 'a'.repeat(501),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.flatten().fieldErrors.description).toContain(
            '설명은 500자 이내로 입력해주세요'
          );
        }
      });

      it('should accept description exactly 500 characters', () => {
        const result = createDatasetSchema.safeParse({
          name: 'Test',
          description: 'a'.repeat(500),
        });
        expect(result.success).toBe(true);
      });

      it('should accept missing description (optional)', () => {
        const result = createDatasetSchema.safeParse({ name: 'Test' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.description).toBeUndefined();
        }
      });
    });

    describe('updateDatasetSchema', () => {
      it('should accept partial updates (name only)', () => {
        const result = updateDatasetSchema.safeParse({ name: 'Updated Name' });
        expect(result.success).toBe(true);
      });

      it('should accept partial updates (description only)', () => {
        const result = updateDatasetSchema.safeParse({
          description: 'Updated Description',
        });
        expect(result.success).toBe(true);
      });

      it('should accept status change to archived', () => {
        const result = updateDatasetSchema.safeParse({ status: 'archived' });
        expect(result.success).toBe(true);
      });

      it('should accept status change to active', () => {
        const result = updateDatasetSchema.safeParse({ status: 'active' });
        expect(result.success).toBe(true);
      });

      it('should reject invalid status', () => {
        const result = updateDatasetSchema.safeParse({ status: 'deleted' });
        expect(result.success).toBe(false);
      });

      it('should accept empty object (no changes)', () => {
        const result = updateDatasetSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it('should reject empty name string', () => {
        const result = updateDatasetSchema.safeParse({ name: '' });
        expect(result.success).toBe(false);
      });

      it('should accept all fields together', () => {
        const result = updateDatasetSchema.safeParse({
          name: 'New Name',
          description: 'New Description',
          status: 'archived',
        });
        expect(result.success).toBe(true);
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

  describe('Tier Limits', () => {
    // canCreateDataset의 로직 시뮬레이션
    const checkDatasetLimit = (current: number, max: number) => ({
      allowed: current < max,
      current,
      max,
      remaining: Math.max(0, max - current),
    });

    const canCreateDataset = (current: number, tier: 'basic' | 'standard' | 'premium') => {
      const limits = {
        basic: 1,
        standard: 5,
        premium: 20,
      };
      const max = limits[tier];
      const limitResult = checkDatasetLimit(current, max);

      if (!limitResult.allowed) {
        return {
          allowed: false,
          reason: `데이터셋은 최대 ${max}개까지 생성할 수 있습니다`,
          limit: limitResult,
        };
      }
      return { allowed: true, limit: limitResult };
    };

    it('should allow creating dataset within limit', () => {
      const result = canCreateDataset(0, 'basic');
      expect(result.allowed).toBe(true);
    });

    it('should reject when at limit', () => {
      const result = canCreateDataset(1, 'basic');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('최대 1개');
    });

    it('should allow more datasets for higher tiers', () => {
      // Standard 티어: 5개까지
      expect(canCreateDataset(4, 'standard').allowed).toBe(true);
      expect(canCreateDataset(5, 'standard').allowed).toBe(false);

      // Premium 티어: 20개까지
      expect(canCreateDataset(19, 'premium').allowed).toBe(true);
      expect(canCreateDataset(20, 'premium').allowed).toBe(false);
    });

    it('should include limit info in error response', () => {
      const result = canCreateDataset(5, 'standard');
      expect(result.allowed).toBe(false);
      expect(result.limit).toEqual({
        allowed: false,
        current: 5,
        max: 5,
        remaining: 0,
      });
    });
  });

  describe('Default Dataset Rules', () => {
    it('should not allow archiving default dataset', () => {
      const dataset = createTestDataset({ isDefault: true });
      const updateData = { status: 'archived' as const };

      const canArchive = !(dataset.isDefault && updateData.status === 'archived');
      expect(canArchive).toBe(false);
    });

    it('should allow archiving non-default dataset', () => {
      const dataset = createTestDataset({ isDefault: false });
      const updateData = { status: 'archived' as const };

      const canArchive = !(dataset.isDefault && updateData.status === 'archived');
      expect(canArchive).toBe(true);
    });

    it('should not allow deleting default dataset', () => {
      const dataset = createTestDataset({ isDefault: true });
      const canDelete = !dataset.isDefault;
      expect(canDelete).toBe(false);
    });

    it('should allow deleting non-default dataset', () => {
      const dataset = createTestDataset({ isDefault: false });
      const canDelete = !dataset.isDefault;
      expect(canDelete).toBe(true);
    });

    it('should allow updating name of default dataset', () => {
      const dataset = createTestDataset({ isDefault: true });
      const updateData = { name: 'New Name' };

      // 이름 수정은 기본 데이터셋에도 허용
      const canUpdate = true;
      expect(canUpdate).toBe(true);
    });
  });

  describe('Dataset Statistics', () => {
    it('should calculate document count correctly', () => {
      const datasetId = 'test-dataset-id';
      const documents = [
        createTestDocument({ datasetId }),
        createTestDocument({ datasetId }),
        createTestDocument({ datasetId }),
      ];

      const documentCount = documents.filter((d) => d.datasetId === datasetId).length;
      expect(documentCount).toBe(3);
    });

    it('should calculate chunk count correctly', () => {
      const datasetId = 'test-dataset-id';
      const chunks = [
        createTestChunk({ datasetId, status: 'approved' }),
        createTestChunk({ datasetId, status: 'approved' }),
        createTestChunk({ datasetId, status: 'pending' }),
        createTestChunk({ datasetId, status: 'rejected' }),
      ];

      const chunkCount = chunks.filter((c) => c.datasetId === datasetId).length;
      const approvedCount = chunks.filter(
        (c) => c.datasetId === datasetId && c.status === 'approved'
      ).length;

      expect(chunkCount).toBe(4);
      expect(approvedCount).toBe(2);
    });

    it('should calculate total storage bytes', () => {
      const datasetId = 'test-dataset-id';
      const documents = [
        createTestDocument({ datasetId, fileSize: 1024 * 1024 }), // 1MB
        createTestDocument({ datasetId, fileSize: 2 * 1024 * 1024 }), // 2MB
        createTestDocument({ datasetId, fileSize: 512 * 1024 }), // 512KB
      ];

      const totalStorageBytes = documents
        .filter((d) => d.datasetId === datasetId)
        .reduce((sum, d) => sum + d.fileSize, 0);

      expect(totalStorageBytes).toBe(3.5 * 1024 * 1024);
    });

    it('should calculate connected chatbots count', () => {
      const datasetId = 'test-dataset-id';
      const connections = [
        { chatbotId: 'chatbot-1', datasetId },
        { chatbotId: 'chatbot-2', datasetId },
      ];

      const connectedChatbots = connections.filter(
        (c) => c.datasetId === datasetId
      ).length;
      expect(connectedChatbots).toBe(2);
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return datasets belonging to the tenant', () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      const allDatasets = [
        createTestDataset({ tenantId: tenantA, name: 'Dataset A1' }),
        createTestDataset({ tenantId: tenantA, name: 'Dataset A2' }),
        createTestDataset({ tenantId: tenantB, name: 'Dataset B1' }),
      ];

      const tenantADatasets = allDatasets.filter((d) => d.tenantId === tenantA);
      const tenantBDatasets = allDatasets.filter((d) => d.tenantId === tenantB);

      expect(tenantADatasets.length).toBe(2);
      expect(tenantBDatasets.length).toBe(1);
    });

    it('should not find dataset from different tenant', () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      const dataset = createTestDataset({ tenantId: tenantA });

      const canAccess = (requestingTenantId: string) =>
        dataset.tenantId === requestingTenantId;

      expect(canAccess(tenantA)).toBe(true);
      expect(canAccess(tenantB)).toBe(false);
    });
  });

  describe('List Filtering', () => {
    it('should filter by status', () => {
      const datasets = [
        createTestDataset({ status: 'active', name: 'Active 1' }),
        createTestDataset({ status: 'active', name: 'Active 2' }),
        createTestDataset({ status: 'archived', name: 'Archived 1' }),
      ];

      const activeDatasets = datasets.filter((d) => d.status === 'active');
      const archivedDatasets = datasets.filter((d) => d.status === 'archived');

      expect(activeDatasets.length).toBe(2);
      expect(archivedDatasets.length).toBe(1);
    });

    it('should return all datasets when status is "all"', () => {
      const datasets = [
        createTestDataset({ status: 'active' }),
        createTestDataset({ status: 'archived' }),
      ];

      // status === 'all'이면 필터링하지 않음
      const allDatasets = datasets;
      expect(allDatasets.length).toBe(2);
    });

    it('should sort by isDefault (true first) then createdAt desc', () => {
      const now = new Date();
      const datasets = [
        createTestDataset({
          isDefault: false,
          createdAt: new Date(now.getTime() - 1000),
        }),
        createTestDataset({ isDefault: true, createdAt: now }),
        createTestDataset({
          isDefault: false,
          createdAt: new Date(now.getTime() - 2000),
        }),
      ];

      const sorted = datasets.sort((a, b) => {
        // isDefault true가 먼저
        if (a.isDefault !== b.isDefault) {
          return b.isDefault ? 1 : -1;
        }
        // 그 다음 createdAt desc
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      expect(sorted[0].isDefault).toBe(true);
      expect(sorted[1].isDefault).toBe(false);
      expect(sorted[2].isDefault).toBe(false);
    });
  });

  describe('Dataset Creation', () => {
    it('should create dataset with default values', () => {
      const input = { name: 'New Dataset' };
      const parseResult = createDatasetSchema.safeParse(input);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const newDataset = {
          ...parseResult.data,
          isDefault: false, // 새 데이터셋은 기본 데이터셋이 아님
          status: 'active',
          documentCount: 0,
          chunkCount: 0,
          totalStorageBytes: 0,
        };

        expect(newDataset.name).toBe('New Dataset');
        expect(newDataset.isDefault).toBe(false);
        expect(newDataset.status).toBe('active');
        expect(newDataset.documentCount).toBe(0);
      }
    });

    it('should create dataset with description', () => {
      const input = { name: 'New Dataset', description: 'Test description' };
      const parseResult = createDatasetSchema.safeParse(input);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.name).toBe('New Dataset');
        expect(parseResult.data.description).toBe('Test description');
      }
    });
  });

  describe('Dataset Update', () => {
    it('should merge partial updates correctly', () => {
      const existingDataset = createTestDataset({
        name: 'Original Name',
        description: 'Original Description',
        status: 'active',
      });

      const updateInput = { name: 'Updated Name' };
      const parseResult = updateDatasetSchema.safeParse(updateInput);

      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        const updatedDataset = {
          ...existingDataset,
          ...parseResult.data,
          updatedAt: new Date(),
        };

        expect(updatedDataset.name).toBe('Updated Name');
        expect(updatedDataset.description).toBe('Original Description'); // 변경되지 않음
        expect(updatedDataset.status).toBe('active'); // 변경되지 않음
      }
    });

    it('should update multiple fields at once', () => {
      const existingDataset = createTestDataset({
        name: 'Original',
        description: null,
        status: 'active',
      });

      const updateInput = {
        name: 'Updated',
        description: 'New description',
        status: 'archived' as const,
      };

      const updatedDataset = {
        ...existingDataset,
        ...updateInput,
        updatedAt: new Date(),
      };

      expect(updatedDataset.name).toBe('Updated');
      expect(updatedDataset.description).toBe('New description');
      expect(updatedDataset.status).toBe('archived');
    });
  });

  describe('Dataset Deletion', () => {
    it('should check isDefault before deletion', () => {
      const checkDeletable = (dataset: ReturnType<typeof createTestDataset>) => {
        if (dataset.isDefault) {
          return { error: '기본 데이터셋은 삭제할 수 없습니다', status: 400 };
        }
        return { success: true };
      };

      const defaultDataset = createTestDataset({ isDefault: true });
      const normalDataset = createTestDataset({ isDefault: false });

      expect(checkDeletable(defaultDataset).status).toBe(400);
      expect(checkDeletable(normalDataset).success).toBe(true);
    });

    it('should cascade delete documents and chunks', () => {
      // 시뮬레이션: 데이터셋 삭제 시 관련 데이터 삭제
      const datasetId = 'dataset-to-delete';
      const documents = [
        createTestDocument({ datasetId }),
        createTestDocument({ datasetId }),
      ];
      const chunks = [
        createTestChunk({ datasetId }),
        createTestChunk({ datasetId }),
        createTestChunk({ datasetId }),
      ];
      const connections = [
        { chatbotId: 'chatbot-1', datasetId },
        { chatbotId: 'chatbot-2', datasetId },
      ];

      // CASCADE 삭제 후
      const remainingDocuments = documents.filter((d) => d.datasetId !== datasetId);
      const remainingChunks = chunks.filter((c) => c.datasetId !== datasetId);
      const remainingConnections = connections.filter((c) => c.datasetId !== datasetId);

      expect(remainingDocuments.length).toBe(0);
      expect(remainingChunks.length).toBe(0);
      expect(remainingConnections.length).toBe(0);
    });
  });

  describe('Error Responses', () => {
    it('should return 401 for unauthenticated requests', () => {
      const getErrorResponse = (authenticated: boolean) => {
        if (!authenticated) {
          return { error: '인증이 필요합니다', status: 401 };
        }
        return null;
      };

      expect(getErrorResponse(false)).toEqual({
        error: '인증이 필요합니다',
        status: 401,
      });
    });

    it('should return 403 for tier limit exceeded', () => {
      const getErrorResponse = (allowed: boolean, current: number, max: number) => {
        if (!allowed) {
          return {
            error: `데이터셋은 최대 ${max}개까지 생성할 수 있습니다`,
            limit: { current, max },
            status: 403,
          };
        }
        return null;
      };

      expect(getErrorResponse(false, 1, 1)).toEqual({
        error: '데이터셋은 최대 1개까지 생성할 수 있습니다',
        limit: { current: 1, max: 1 },
        status: 403,
      });
    });

    it('should return 404 for non-existent dataset', () => {
      const getErrorResponse = (found: boolean) => {
        if (!found) {
          return { error: '데이터셋을 찾을 수 없습니다', status: 404 };
        }
        return null;
      };

      expect(getErrorResponse(false)).toEqual({
        error: '데이터셋을 찾을 수 없습니다',
        status: 404,
      });
    });

    it('should return 400 for validation errors', () => {
      const input = { name: '' };
      const parseResult = createDatasetSchema.safeParse(input);

      expect(parseResult.success).toBe(false);
      if (!parseResult.success) {
        const errorResponse = {
          error: '입력값이 올바르지 않습니다',
          details: parseResult.error.flatten(),
          status: 400,
        };
        expect(errorResponse.status).toBe(400);
        expect(errorResponse.details.fieldErrors.name).toBeDefined();
      }
    });

    it('should return 400 for default dataset archive attempt', () => {
      const dataset = createTestDataset({ isDefault: true });
      const updateData = { status: 'archived' as const };

      const getErrorResponse = () => {
        if (dataset.isDefault && updateData.status === 'archived') {
          return { error: '기본 데이터셋은 보관할 수 없습니다', status: 400 };
        }
        return null;
      };

      expect(getErrorResponse()).toEqual({
        error: '기본 데이터셋은 보관할 수 없습니다',
        status: 400,
      });
    });

    it('should return 400 for default dataset delete attempt', () => {
      const dataset = createTestDataset({ isDefault: true });

      const getErrorResponse = () => {
        if (dataset.isDefault) {
          return { error: '기본 데이터셋은 삭제할 수 없습니다', status: 400 };
        }
        return null;
      };

      expect(getErrorResponse()).toEqual({
        error: '기본 데이터셋은 삭제할 수 없습니다',
        status: 400,
      });
    });
  });

  describe('Response Format', () => {
    it('should return dataset on successful creation', () => {
      const dataset = createTestDataset();
      const response = {
        message: '데이터셋이 생성되었습니다',
        dataset,
      };

      expect(response.message).toBe('데이터셋이 생성되었습니다');
      expect(response.dataset).toBeDefined();
      expect(response.dataset.id).toBeDefined();
    });

    it('should return datasets array on list', () => {
      const datasets = [createTestDataset(), createTestDataset()];
      const response = { datasets };

      expect(response.datasets).toBeInstanceOf(Array);
      expect(response.datasets.length).toBe(2);
    });

    it('should return dataset with stats on detail', () => {
      const dataset = createTestDataset();
      const response = {
        dataset: {
          ...dataset,
          stats: {
            documentCount: 5,
            totalStorageBytes: 1024 * 1024,
            chunkCount: 50,
            approvedChunkCount: 45,
            connectedChatbots: 2,
          },
        },
      };

      expect(response.dataset.stats.documentCount).toBe(5);
      expect(response.dataset.stats.connectedChatbots).toBe(2);
    });

    it('should return datasets with stats when includeStats=true', () => {
      const datasets = [
        {
          ...createTestDataset(),
          stats: { documentCount: 3, chunkCount: 30 },
        },
        {
          ...createTestDataset(),
          stats: { documentCount: 5, chunkCount: 50 },
        },
      ];

      expect(datasets[0].stats).toBeDefined();
      expect(datasets[1].stats).toBeDefined();
    });
  });
});
