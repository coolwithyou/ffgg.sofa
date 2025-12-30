/**
 * 테스트 데이터 팩토리
 * 테스트에서 사용할 Mock 데이터 생성 함수
 */

import { v4 as uuidv4 } from 'uuid';

// 테넌트 팩토리
export const createTestTenant = (overrides: Partial<TestTenant> = {}): TestTenant => ({
  id: uuidv4(),
  name: 'Test Tenant',
  tier: 'basic',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 챗봇 팩토리
export const createTestChatbot = (overrides: Partial<TestChatbot> = {}): TestChatbot => ({
  id: uuidv4(),
  tenantId: 'test-tenant-id',
  name: 'Test Chatbot',
  description: null,
  isDefault: false,
  status: 'active',
  widgetEnabled: false,
  widgetApiKey: null,
  widgetConfig: {},
  kakaoEnabled: false,
  kakaoBotId: null,
  kakaoConfig: {},
  llmConfig: { temperature: 0.7, maxTokens: 1024, systemPrompt: null },
  searchConfig: { maxChunks: 5, minScore: 0.5 },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 데이터셋 팩토리
export const createTestDataset = (overrides: Partial<TestDataset> = {}): TestDataset => ({
  id: uuidv4(),
  tenantId: 'test-tenant-id',
  name: 'Test Dataset',
  description: null,
  isDefault: false,
  status: 'active',
  documentCount: 0,
  chunkCount: 0,
  totalStorageBytes: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 챗봇-데이터셋 연결 팩토리
export const createTestChatbotDataset = (
  overrides: Partial<TestChatbotDataset> = {}
): TestChatbotDataset => ({
  id: uuidv4(),
  chatbotId: 'test-chatbot-id',
  datasetId: 'test-dataset-id',
  weight: 1.0,
  createdAt: new Date(),
  ...overrides,
});

// 문서 팩토리
export const createTestDocument = (overrides: Partial<TestDocument> = {}): TestDocument => ({
  id: uuidv4(),
  tenantId: 'test-tenant-id',
  datasetId: 'test-dataset-id',
  filename: 'test-document.pdf',
  filePath: 'documents/test-tenant-id/test-document.pdf',
  fileSize: 1024,
  fileType: 'application/pdf',
  status: 'completed',
  progressPercent: 100,
  errorMessage: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 청크 팩토리
export const createTestChunk = (overrides: Partial<TestChunk> = {}): TestChunk => ({
  id: uuidv4(),
  tenantId: 'test-tenant-id',
  datasetId: 'test-dataset-id',
  documentId: 'test-document-id',
  content: 'This is test chunk content for testing purposes.',
  embedding: Array(1536).fill(0.1),
  status: 'approved',
  isActive: true,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 대화 팩토리
export const createTestConversation = (
  overrides: Partial<TestConversation> = {}
): TestConversation => ({
  id: uuidv4(),
  tenantId: 'test-tenant-id',
  chatbotId: null,
  sessionId: uuidv4(),
  channel: 'web',
  messages: [],
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// 세션 팩토리
export const createTestSession = (overrides: Partial<TestSession> = {}): TestSession => ({
  userId: 'test-user-id',
  email: 'test@example.com',
  tenantId: 'test-tenant-id',
  role: 'admin',
  isLoggedIn: true,
  ...overrides,
});

// 타입 정의
export interface TestTenant {
  id: string;
  name: string;
  tier: 'basic' | 'standard' | 'premium';
  createdAt: Date;
  updatedAt: Date;
}

export interface TestChatbot {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: 'active' | 'inactive';
  widgetEnabled: boolean;
  widgetApiKey: string | null;
  widgetConfig: Record<string, unknown>;
  kakaoEnabled: boolean;
  kakaoBotId: string | null;
  kakaoConfig: Record<string, unknown>;
  llmConfig: {
    temperature: number;
    maxTokens: number;
    systemPrompt: string | null;
  };
  searchConfig: {
    maxChunks: number;
    minScore: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDataset {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: 'active' | 'archived';
  documentCount: number;
  chunkCount: number;
  totalStorageBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestChatbotDataset {
  id: string;
  chatbotId: string;
  datasetId: string;
  weight: number;
  createdAt: Date;
}

export interface TestDocument {
  id: string;
  tenantId: string;
  datasetId: string;
  filename: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  progressPercent: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestChunk {
  id: string;
  tenantId: string;
  datasetId: string;
  documentId: string;
  content: string;
  embedding: number[];
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestConversation {
  id: string;
  tenantId: string;
  chatbotId: string | null;
  sessionId: string;
  channel: 'web' | 'kakao';
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSession {
  userId: string;
  email: string;
  tenantId: string;
  role: 'admin' | 'member';
  isLoggedIn: boolean;
}

// 다수의 테스트 데이터 생성 헬퍼
export const createMultiple = <T>(
  factory: (overrides?: Partial<T>) => T,
  count: number,
  overridesFn?: (index: number) => Partial<T>
): T[] => {
  return Array.from({ length: count }, (_, index) =>
    factory(overridesFn ? overridesFn(index) : undefined)
  );
};

// 티어별 한도 테스트용 데이터
export const TIER_TEST_DATA = {
  basic: {
    maxChatbots: 3,
    maxDatasets: 3,
    maxDocumentsPerDataset: 10,
    maxTotalDocuments: 10,
    maxStorageBytes: 100 * 1024 * 1024,
    maxChunksPerDocument: 100,
    maxMonthlyConversations: 1000,
    apiRateLimit: 60,
    chatRateLimitPerDay: 100,
    uploadRateLimitPerHour: 10,
  },
  standard: {
    maxChatbots: 10,
    maxDatasets: 10,
    maxDocumentsPerDataset: 50,
    maxTotalDocuments: 100,
    maxStorageBytes: 1024 * 1024 * 1024,
    maxChunksPerDocument: 500,
    maxMonthlyConversations: 10000,
    apiRateLimit: 300,
    chatRateLimitPerDay: 1000,
    uploadRateLimitPerHour: 50,
  },
  premium: {
    maxChatbots: 50,
    maxDatasets: 50,
    maxDocumentsPerDataset: 200,
    maxTotalDocuments: 500,
    maxStorageBytes: 10 * 1024 * 1024 * 1024,
    maxChunksPerDocument: 1000,
    maxMonthlyConversations: 100000,
    apiRateLimit: 1000,
    chatRateLimitPerDay: 10000,
    uploadRateLimitPerHour: 200,
  },
};
