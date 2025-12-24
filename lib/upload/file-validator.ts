/**
 * 파일 보안 검증
 * - 확장자 검증
 * - Magic Number (파일 시그니처) 검증
 * - 파일 크기 제한
 */

import { logger } from '@/lib/logger';

// 허용된 파일 타입과 Magic Number 정의
export const ALLOWED_FILE_TYPES = {
  // 문서
  'application/pdf': {
    extensions: ['.pdf'],
    magicNumbers: [
      [0x25, 0x50, 0x44, 0x46], // %PDF
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['.docx'],
    magicNumbers: [
      [0x50, 0x4b, 0x03, 0x04], // PK (ZIP)
    ],
    maxSize: 50 * 1024 * 1024,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['.xlsx'],
    magicNumbers: [
      [0x50, 0x4b, 0x03, 0x04], // PK (ZIP)
    ],
    maxSize: 50 * 1024 * 1024,
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    extensions: ['.pptx'],
    magicNumbers: [
      [0x50, 0x4b, 0x03, 0x04], // PK (ZIP)
    ],
    maxSize: 50 * 1024 * 1024,
  },
  // 텍스트
  'text/plain': {
    extensions: ['.txt'],
    magicNumbers: [], // 텍스트 파일은 Magic Number 없음
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  'text/markdown': {
    extensions: ['.md'],
    magicNumbers: [],
    maxSize: 10 * 1024 * 1024,
  },
  'text/csv': {
    extensions: ['.csv'],
    magicNumbers: [],
    maxSize: 50 * 1024 * 1024,
  },
  // JSON
  'application/json': {
    extensions: ['.json'],
    magicNumbers: [],
    maxSize: 10 * 1024 * 1024,
  },
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES;

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedFilename?: string;
  detectedMimeType?: string;
}

/**
 * 파일 확장자 추출 (소문자)
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Magic Number 검증
 */
function checkMagicNumber(
  buffer: ArrayBuffer,
  expectedMagics: readonly (readonly number[])[]
): boolean {
  if (expectedMagics.length === 0) {
    return true; // Magic Number 검증 필요 없음
  }

  const bytes = new Uint8Array(buffer);

  return expectedMagics.some((magic) => {
    if (bytes.length < magic.length) {
      return false;
    }
    return magic.every((byte, index) => bytes[index] === byte);
  });
}

/**
 * 파일명 위생 처리
 * - 위험한 문자 제거
 * - 길이 제한
 * - 경로 순회 방지
 */
export function sanitizeFilename(filename: string): string {
  // 경로 구분자 제거 (경로 순회 방지)
  let sanitized = filename.replace(/[/\\]/g, '_');

  // 숨김 파일 방지 (앞의 점 제거)
  sanitized = sanitized.replace(/^\.+/, '');

  // 위험한 문자 제거
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '_');

  // 연속된 점 제거
  sanitized = sanitized.replace(/\.{2,}/g, '.');

  // 앞뒤 공백/점 제거
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

  // 길이 제한 (255자)
  if (sanitized.length > 255) {
    const ext = getFileExtension(sanitized);
    const name = sanitized.slice(0, 255 - ext.length - 1);
    sanitized = name + ext;
  }

  // 빈 파일명 처리
  if (!sanitized || sanitized === '') {
    sanitized = 'unnamed_file';
  }

  return sanitized;
}

/**
 * MIME 타입이 허용된 타입인지 확인
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return mimeType in ALLOWED_FILE_TYPES;
}

/**
 * 확장자로 MIME 타입 추론
 */
export function getMimeTypeFromExtension(extension: string): AllowedMimeType | null {
  const ext = extension.toLowerCase();

  for (const [mimeType, config] of Object.entries(ALLOWED_FILE_TYPES)) {
    if ((config.extensions as readonly string[]).includes(ext)) {
      return mimeType as AllowedMimeType;
    }
  }

  return null;
}

/**
 * 파일 전체 검증
 */
export async function validateFile(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: AllowedMimeType[];
  } = {}
): Promise<FileValidationResult> {
  const errors: string[] = [];
  const filename = file.name;
  const extension = getFileExtension(filename);
  const sanitizedFilename = sanitizeFilename(filename);

  // 1. 확장자 존재 확인
  if (!extension) {
    errors.push('파일 확장자가 없습니다.');
    return { valid: false, errors, sanitizedFilename };
  }

  // 2. 확장자로 MIME 타입 추론
  const expectedMimeType = getMimeTypeFromExtension(extension);

  if (!expectedMimeType) {
    errors.push(`허용되지 않은 파일 확장자입니다: ${extension}`);
    return { valid: false, errors, sanitizedFilename };
  }

  // 3. 허용된 타입 목록 확인 (옵션)
  if (options.allowedTypes && !options.allowedTypes.includes(expectedMimeType)) {
    errors.push(`이 타입의 파일은 허용되지 않습니다: ${expectedMimeType}`);
    return { valid: false, errors, sanitizedFilename };
  }

  const typeConfig = ALLOWED_FILE_TYPES[expectedMimeType];

  // 4. 파일 크기 확인
  const maxSize = options.maxSize || typeConfig.maxSize;
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    errors.push(`파일 크기가 ${maxSizeMB}MB를 초과합니다.`);
    return { valid: false, errors, sanitizedFilename };
  }

  if (file.size === 0) {
    errors.push('빈 파일은 업로드할 수 없습니다.');
    return { valid: false, errors, sanitizedFilename };
  }

  // 5. Magic Number 검증
  if (typeConfig.magicNumbers.length > 0) {
    try {
      // 처음 16바이트만 읽음
      const headerSlice = file.slice(0, 16);
      const headerBuffer = await headerSlice.arrayBuffer();

      if (!checkMagicNumber(headerBuffer, typeConfig.magicNumbers)) {
        logger.warn('Magic number mismatch', {
          filename: sanitizedFilename,
          expectedType: expectedMimeType,
          declaredType: file.type,
        });
        errors.push('파일 내용이 확장자와 일치하지 않습니다.');
        return { valid: false, errors, sanitizedFilename };
      }
    } catch (error) {
      logger.error('Failed to read file header', error as Error);
      errors.push('파일을 읽을 수 없습니다.');
      return { valid: false, errors, sanitizedFilename };
    }
  }

  // 6. 선언된 MIME 타입과 추론된 타입 비교 (경고만)
  if (file.type && file.type !== expectedMimeType) {
    // 일부 브라우저는 다른 MIME 타입을 보낼 수 있음
    logger.info('MIME type mismatch (allowed)', {
      filename: sanitizedFilename,
      declaredType: file.type,
      expectedType: expectedMimeType,
    });
  }

  return {
    valid: true,
    errors: [],
    sanitizedFilename,
    detectedMimeType: expectedMimeType,
  };
}

/**
 * 여러 파일 검증
 */
export async function validateFiles(
  files: File[],
  options: {
    maxFiles?: number;
    maxTotalSize?: number;
    maxSize?: number;
    allowedTypes?: AllowedMimeType[];
  } = {}
): Promise<{
  valid: boolean;
  results: Map<string, FileValidationResult>;
  errors: string[];
}> {
  const errors: string[] = [];
  const results = new Map<string, FileValidationResult>();

  // 파일 개수 제한
  const maxFiles = options.maxFiles || 10;
  if (files.length > maxFiles) {
    errors.push(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
    return { valid: false, results, errors };
  }

  // 총 크기 제한
  const maxTotalSize = options.maxTotalSize || 100 * 1024 * 1024; // 100MB
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > maxTotalSize) {
    const maxTotalSizeMB = Math.round(maxTotalSize / (1024 * 1024));
    errors.push(`총 파일 크기가 ${maxTotalSizeMB}MB를 초과합니다.`);
    return { valid: false, results, errors };
  }

  // 각 파일 검증
  let allValid = true;
  for (const file of files) {
    const result = await validateFile(file, {
      maxSize: options.maxSize,
      allowedTypes: options.allowedTypes,
    });
    results.set(file.name, result);
    if (!result.valid) {
      allValid = false;
    }
  }

  return { valid: allValid, results, errors };
}
