/**
 * API 클라이언트 추상화
 * 클라이언트 측 fetch 래퍼로 일관된 에러 처리 제공
 */

import { type ErrorCodeType } from './errors';

/**
 * API 에러 응답 형식 (서버의 AppError.toSafeResponse와 일치)
 */
export interface ApiErrorResponse {
  error: {
    code: ErrorCodeType;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 클라이언트 측 API 에러 클래스
 */
export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCodeType,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  /**
   * 특정 에러 코드인지 확인
   */
  is(code: ErrorCodeType): boolean {
    return this.code === code;
  }
}

/**
 * API 요청 옵션 (fetch RequestInit 확장)
 */
interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** JSON body (자동 직렬화) */
  body?: unknown;
  /** 타임아웃 (ms), 기본값 30초 */
  timeout?: number;
}

/**
 * 타임아웃이 포함된 fetch 래퍼
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * API 요청 함수
 *
 * @example
 * // GET 요청
 * const data = await apiRequest<UserData>('/api/users/me');
 *
 * @example
 * // POST 요청
 * const result = await apiRequest<CreateResponse>('/api/items', {
 *   method: 'POST',
 *   body: { name: 'New Item' },
 * });
 *
 * @example
 * // 에러 처리
 * try {
 *   await apiRequest('/api/protected');
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     if (error.is('AUTH_1001')) {
 *       // 인증 필요
 *     }
 *   }
 * }
 */
export async function apiRequest<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { body, timeout = 30000, ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  // JSON body 처리
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetchWithTimeout(
    url,
    {
      ...fetchOptions,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    timeout
  );

  // 응답 본문 파싱
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    // 에러 응답 처리
    if (isJson) {
      const errorData = (await response.json()) as ApiErrorResponse;
      throw new ApiError(
        errorData.error.code,
        errorData.error.message,
        response.status,
        errorData.error.details
      );
    }

    // JSON이 아닌 에러 응답
    const text = await response.text();
    throw new ApiError(
      'SRV_9001' as ErrorCodeType,
      text || `HTTP ${response.status}`,
      response.status
    );
  }

  // 성공 응답
  if (isJson) {
    return (await response.json()) as T;
  }

  // 빈 응답 또는 비-JSON 응답
  return undefined as T;
}

/**
 * GET 요청 단축 함수
 */
export function get<T>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * POST 요청 단축 함수
 */
export function post<T>(
  url: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'POST', body });
}

/**
 * PUT 요청 단축 함수
 */
export function put<T>(
  url: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'PUT', body });
}

/**
 * PATCH 요청 단축 함수
 */
export function patch<T>(
  url: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'PATCH', body });
}

/**
 * DELETE 요청 단축 함수
 */
export function del<T>(url: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<T> {
  return apiRequest<T>(url, { ...options, method: 'DELETE' });
}

/**
 * API 클라이언트 네임스페이스 (선택적 사용)
 *
 * @example
 * import { api } from '@/lib/api-client';
 * const user = await api.get<User>('/api/users/me');
 * await api.post('/api/items', { name: 'New Item' });
 */
export const api = {
  request: apiRequest,
  get,
  post,
  put,
  patch,
  del,
} as const;
