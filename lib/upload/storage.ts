/**
 * 스토리지 업로드 유틸리티
 * S3 호환 스토리지 (AWS S3, Cloudflare R2, MinIO 등) 또는 로컬 파일 시스템 지원
 *
 * 개발 환경에서 S3가 설정되지 않으면 자동으로 로컬 저장소 사용
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

// 로컬 저장소 설정
const LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || './uploads';
const USE_LOCAL_STORAGE = !isS3Configured();

/**
 * S3가 제대로 설정되어 있는지 확인
 */
function isS3Configured(): boolean {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET;

  // 플레이스홀더 값 체크
  const isPlaceholder = (value: string | undefined) =>
    !value ||
    value.startsWith('your-') ||
    value === 'your-bucket-name' ||
    value === 'your-access-key' ||
    value === 'your-secret-key';

  if (isPlaceholder(accessKeyId) || isPlaceholder(secretAccessKey) || isPlaceholder(bucket)) {
    return false;
  }

  return true;
}

// ============================================================
// 로컬 저장소 함수들
// ============================================================

/**
 * 로컬 디렉토리 생성 (재귀적)
 */
async function ensureLocalDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // 이미 존재하면 무시
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * 로컬 파일 경로 생성
 */
function getLocalFilePath(key: string): string {
  return path.join(LOCAL_UPLOAD_DIR, key);
}

/**
 * 로컬 저장소에 파일 업로드
 */
async function uploadFileLocal(
  file: Buffer | Uint8Array,
  key: string,
  tenantId: string
): Promise<UploadResult> {
  try {
    const filePath = getLocalFilePath(key);
    const dirPath = path.dirname(filePath);

    await ensureLocalDir(dirPath);
    await fs.writeFile(filePath, file);

    logger.info('File uploaded to local storage', {
      key,
      path: filePath,
      tenantId,
      size: file.length,
    });

    // 로컬 URL (개발용)
    const url = `/api/files/${key}`;

    return {
      success: true,
      key,
      url,
    };
  } catch (error) {
    logger.error('Local file upload failed', error as Error, {
      key,
      tenantId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * 로컬 저장소에서 파일 삭제
 */
async function deleteFileLocal(
  key: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 테넌트 격리
    if (!key.startsWith(`${tenantId}/`)) {
      logger.warn('Unauthorized local file deletion attempt', { key, tenantId });
      return { success: false, error: 'Unauthorized' };
    }

    const filePath = getLocalFilePath(key);
    await fs.unlink(filePath);

    logger.info('File deleted from local storage', { key, tenantId });

    return { success: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // 파일이 없으면 성공으로 처리
      return { success: true };
    }

    logger.error('Local file deletion failed', error as Error, { key, tenantId });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deletion failed',
    };
  }
}

/**
 * 로컬 저장소에서 파일 읽기
 */
async function getFileFromLocalStorage(
  key: string,
  tenantId: string
): Promise<Buffer> {
  // 테넌트 격리
  if (!key.startsWith(`${tenantId}/`)) {
    throw new Error('Unauthorized: Access denied to the requested file');
  }

  const filePath = getLocalFilePath(key);
  return fs.readFile(filePath);
}

// ============================================================
// S3 스토리지 함수들
// ============================================================

// S3 클라이언트 설정
function createS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials not configured');
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // MinIO 등 호환 서비스용
  });
}

// 싱글톤 클라이언트 (지연 초기화)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
}

// 버킷 이름
function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET not configured');
  }
  return bucket;
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export interface UploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  tenantId: string;
}

/**
 * 고유한 파일 키 생성
 * 형식: {tenantId}/{folder}/{yyyy}/{mm}/{uuid}_{filename}
 */
function generateFileKey(
  tenantId: string,
  filename: string,
  folder: string = 'documents'
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = uuidv4();

  // 파일명 안전하게 처리
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return `${tenantId}/${folder}/${year}/${month}/${uuid}_${safeFilename}`;
}

/**
 * 파일 업로드
 * S3가 설정되지 않으면 로컬 저장소 사용
 */
export async function uploadFile(
  file: Buffer | Uint8Array,
  options: UploadOptions & { filename: string }
): Promise<UploadResult> {
  const key = generateFileKey(
    options.tenantId,
    options.filename,
    options.folder
  );

  // S3가 설정되지 않으면 로컬 저장소 사용
  if (USE_LOCAL_STORAGE) {
    logger.info('Using local storage (S3 not configured)');
    return uploadFileLocal(file, key, options.tenantId);
  }

  try {
    const client = getS3Client();
    const bucket = getBucket();

    // S3 메타데이터는 ASCII만 허용하므로 UTF-8 문자열을 인코딩
    const safeMetadata: Record<string, string> = {};
    if (options.metadata) {
      for (const [key, value] of Object.entries(options.metadata)) {
        // 값에 비ASCII 문자가 있으면 URI 인코딩
        safeMetadata[key] = encodeURIComponent(value);
      }
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: options.contentType || 'application/octet-stream',
      Metadata: {
        ...safeMetadata,
        tenantId: options.tenantId,
        uploadedAt: new Date().toISOString(),
      },
    });

    await client.send(command);

    logger.info('File uploaded successfully', {
      key,
      bucket,
      tenantId: options.tenantId,
      size: file.length,
    });

    // Public URL 생성
    // 우선순위: CDN_URL > 프록시 API
    // CDN이 없으면 프록시 API를 통해 파일 제공 (R2 인증 문제 해결)
    const cdnUrl = process.env.CDN_URL;
    const url = cdnUrl
      ? `${cdnUrl}/${key}`
      : `/api/files/${key}`;

    return {
      success: true,
      key,
      url,
    };
  } catch (error) {
    logger.error('File upload failed', error as Error, {
      tenantId: options.tenantId,
      filename: options.filename,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * 파일 삭제
 * S3가 설정되지 않으면 로컬 저장소 사용
 */
export async function deleteFile(
  key: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  // S3가 설정되지 않으면 로컬 저장소 사용
  if (USE_LOCAL_STORAGE) {
    return deleteFileLocal(key, tenantId);
  }

  try {
    // 테넌트 격리: key가 해당 테넌트의 것인지 확인
    if (!key.startsWith(`${tenantId}/`)) {
      logger.warn('Unauthorized file deletion attempt', {
        key,
        tenantId,
      });
      return { success: false, error: 'Unauthorized' };
    }

    const client = getS3Client();
    const bucket = getBucket();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);

    logger.info('File deleted successfully', {
      key,
      bucket,
      tenantId,
    });

    return { success: true };
  } catch (error) {
    logger.error('File deletion failed', error as Error, {
      key,
      tenantId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deletion failed',
    };
  }
}

/**
 * 서명된 다운로드 URL 생성 (일시적 접근)
 */
export async function getSignedDownloadUrl(
  key: string,
  tenantId: string,
  expiresIn: number = 3600 // 1시간
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // 테넌트 격리
    if (!key.startsWith(`${tenantId}/`)) {
      return { success: false, error: 'Unauthorized' };
    }

    const client = getS3Client();
    const bucket = getBucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn });

    return { success: true, url };
  } catch (error) {
    logger.error('Failed to generate signed URL', error as Error, {
      key,
      tenantId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate URL',
    };
  }
}

/**
 * 서명된 업로드 URL 생성 (클라이언트 직접 업로드용)
 */
export async function getSignedUploadUrl(
  filename: string,
  contentType: string,
  tenantId: string,
  folder: string = 'documents',
  expiresIn: number = 900 // 15분
): Promise<{
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}> {
  try {
    const client = getS3Client();
    const bucket = getBucket();
    const key = generateFileKey(tenantId, filename, folder);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: {
        tenantId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const url = await getSignedUrl(client, command, { expiresIn });

    logger.info('Signed upload URL generated', {
      key,
      bucket,
      tenantId,
      expiresIn,
    });

    return { success: true, url, key };
  } catch (error) {
    logger.error('Failed to generate signed upload URL', error as Error, {
      tenantId,
      filename,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate URL',
    };
  }
}

/**
 * 테넌트별 사용량 확인용 prefix 리스트
 */
export function getTenantPrefix(tenantId: string): string {
  return `${tenantId}/`;
}

/**
 * 스토리지에서 파일 다운로드
 * S3가 설정되지 않으면 로컬 저장소 사용
 * @param key - 파일 키 (경로)
 * @param tenantId - 테넌트 ID (권한 검증용)
 */
export async function getFileFromStorage(
  key: string,
  tenantId: string
): Promise<Buffer> {
  // S3가 설정되지 않으면 로컬 저장소 사용
  if (USE_LOCAL_STORAGE) {
    return getFileFromLocalStorage(key, tenantId);
  }

  // 테넌트 격리: key가 해당 테넌트의 prefix로 시작하는지 검증
  const expectedPrefix = `${tenantId}/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error('Unauthorized: Access denied to the requested file');
  }

  try {
    const client = getS3Client();
    const bucket = getBucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Readable stream을 Buffer로 변환
    const chunks: Uint8Array[] = [];
    const body = response.Body as NodeJS.ReadableStream;

    for await (const chunk of body) {
      chunks.push(chunk as Uint8Array);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    logger.error('Failed to download file from storage', error as Error, {
      key,
      tenantId,
    });
    throw error;
  }
}

/**
 * 현재 사용 중인 스토리지 타입 확인
 */
export function getStorageType(): 'local' | 's3' {
  return USE_LOCAL_STORAGE ? 'local' : 's3';
}
