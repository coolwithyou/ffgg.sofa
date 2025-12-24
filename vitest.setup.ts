import { vi } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Map()),
}));

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = 'test_session_secret_must_be_at_least_32_chars_long';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_ACCESS_KEY_ID = 'test-access-key';
process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.S3_ENDPOINT = 'http://localhost:9000';
