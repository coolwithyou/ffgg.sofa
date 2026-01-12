'use server';

/**
 * Knowledge Pages (블로그) 서버 액션
 *
 * Knowledge Pages는 RAG 청킹 단위를 사람이 읽을 수 있는 페이지 형태로 관리하는 기능입니다.
 * 핵심 컨셉: 1 Page = 1 Chunk = 1 읽을 수 있는 문서
 */

import {
  db,
  knowledgePages,
  knowledgePageVersions,
  documents,
  chatbots,
  type KnowledgePage,
  type NewKnowledgePage,
  type NewKnowledgePageVersion,
} from '@/lib/db';
import { eq, and, desc, asc, isNull, sql, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { embedText } from '@/lib/rag/embedding';
import { validateFile, uploadFile, type AllowedMimeType } from '@/lib/upload';
import { inngestClient } from '@/inngest/client';
import { logger } from '@/lib/logger';

// ========================================
// 타입 정의
// ========================================

export interface KnowledgePageTreeNode {
  id: string;
  title: string;
  path: string;
  depth: number;
  status: string;
  isIndexed: boolean;
  children: KnowledgePageTreeNode[];
}

export interface CreateKnowledgePageInput {
  chatbotId: string;
  parentId?: string | null;
  title: string;
  content?: string;
  /** 원본 문서 ID (문서 → 페이지 자동 변환 시 사용) */
  sourceDocumentId?: string;
}

export interface UpdateKnowledgePageInput {
  title?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  parentId?: string | null;
  sortOrder?: number;
}

// 문서 → 페이지 변환에 허용된 파일 타입
const DOCUMENT_TO_PAGES_ALLOWED_TYPES: AllowedMimeType[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
];

// ========================================
// 문서 업로드 → 페이지 변환
// ========================================

/**
 * 문서를 업로드하고 Knowledge Pages로 변환
 *
 * 일반 문서 업로드와 다른 점:
 * - RAG 청킹 파이프라인을 거치지 않음
 * - 바로 LLM을 통해 Knowledge Pages로 변환
 * - 변환된 페이지는 Draft 상태로 생성
 *
 * @param formData - file: File, chatbotId: string, parentPageId?: string, skipConversion?: string
 *
 * skipConversion 옵션:
 * - 'true'로 설정 시 Inngest 변환 이벤트를 발송하지 않음
 * - Human-in-the-loop 검증 플로우에서 사용 (문서 업로드 후 별도로 검증 시작)
 */
export async function uploadAndConvertDocument(
  formData: FormData
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId || !session?.userId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 1. FormData 파싱
    const file = formData.get('file') as File | null;
    const chatbotId = formData.get('chatbotId') as string | null;
    const parentPageId = formData.get('parentPageId') as string | null;
    const skipConversion = formData.get('skipConversion') === 'true';

    if (!file) {
      return { success: false, error: '파일이 필요합니다.' };
    }

    if (!chatbotId) {
      return { success: false, error: 'chatbotId가 필요합니다.' };
    }

    // 2. 챗봇 소유권 확인
    const [chatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, chatbotId),
          eq(chatbots.tenantId, session.tenantId)
        )
      )
      .limit(1);

    if (!chatbot) {
      return { success: false, error: '챗봇을 찾을 수 없습니다.' };
    }

    // 3. 파일 검증 (확장자 + Magic Number)
    const validationResult = await validateFile(file, {
      allowedTypes: DOCUMENT_TO_PAGES_ALLOWED_TYPES,
    });

    if (!validationResult.valid) {
      logger.warn('[Blog] File validation failed for page conversion', {
        filename: file.name,
        errors: validationResult.errors,
        userId: session.userId,
        tenantId: session.tenantId,
      });
      return { success: false, error: validationResult.errors.join(', ') };
    }

    // 4. 파일 업로드 (스토리지)
    const fileBuffer = await file.arrayBuffer();
    const uploadResult = await uploadFile(Buffer.from(fileBuffer), {
      tenantId: session.tenantId,
      filename: validationResult.sanitizedFilename!,
      contentType: validationResult.detectedMimeType,
      folder: 'documents', // 기존 문서와 같은 폴더 사용
      metadata: {
        originalFilename: file.name,
        uploadedBy: session.userId,
        purpose: 'knowledge-pages', // 구분용 메타데이터
      },
    });

    if (!uploadResult.success) {
      logger.error('[Blog] File upload failed', new Error(uploadResult.error || 'Unknown error'), {
        filename: file.name,
        tenantId: session.tenantId,
      });
      return { success: false, error: '파일 업로드에 실패했습니다.' };
    }

    // 5. DB에 문서 레코드 생성 (출처 추적용, datasetId는 null)
    // skipConversion: HITL 검증용으로 업로드만 하는 경우 'approved' 상태로 설정
    const [document] = await db
      .insert(documents)
      .values({
        tenantId: session.tenantId,
        datasetId: null, // 라이브러리/데이터셋에 속하지 않음
        filename: validationResult.sanitizedFilename!,
        filePath: uploadResult.key!,
        fileSize: file.size,
        fileType: validationResult.detectedMimeType,
        status: skipConversion ? 'approved' : 'processing', // HITL용은 approved, 직접 변환은 processing
        metadata: {
          originalFilename: file.name,
          uploadedBy: session.userId,
          url: uploadResult.url,
          purpose: skipConversion ? 'hitl-validation' : 'knowledge-pages',
          chatbotId, // 어떤 챗봇의 페이지로 변환되는지 기록
        },
      })
      .returning();

    // 6. Inngest 이벤트 발송 (문서 → 페이지 변환)
    // skipConversion이 true면 HITL 검증 플로우를 사용하므로 변환 이벤트 발송 안함
    if (!skipConversion) {
      await inngestClient.send({
        name: 'document/convert-to-pages',
        data: {
          documentId: document.id,
          chatbotId,
          tenantId: session.tenantId,
          options: parentPageId ? { parentPageId } : undefined,
        },
      });
    }

    logger.info('[Blog] Document uploaded', {
      documentId: document.id,
      chatbotId,
      filename: validationResult.sanitizedFilename,
      tenantId: session.tenantId,
      userId: session.userId,
      mode: skipConversion ? 'hitl-validation' : 'direct-conversion',
    });

    revalidatePath('/console/chatbot/blog');

    return { success: true, documentId: document.id };
  } catch (error) {
    logger.error('[Blog] Document upload for page conversion failed', error as Error, {
      tenantId: session.tenantId,
      userId: session.userId,
    });
    return { success: false, error: '문서 업로드에 실패했습니다.' };
  }
}

// ========================================
// 조회
// ========================================

/**
 * 페이지 목록 조회 (플랫 리스트)
 */
export async function getKnowledgePages(chatbotId: string): Promise<KnowledgePage[]> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  const pages = await db
    .select()
    .from(knowledgePages)
    .where(
      and(
        eq(knowledgePages.tenantId, session.tenantId),
        eq(knowledgePages.chatbotId, chatbotId)
      )
    )
    .orderBy(asc(knowledgePages.depth), asc(knowledgePages.sortOrder), asc(knowledgePages.createdAt));

  return pages;
}

/**
 * 페이지 목록을 트리 구조로 변환
 */
export async function getKnowledgePagesTree(chatbotId: string): Promise<KnowledgePageTreeNode[]> {
  const pages = await getKnowledgePages(chatbotId);
  return buildTree(pages);
}

/**
 * 단일 페이지 조회
 */
export async function getKnowledgePage(pageId: string): Promise<KnowledgePage | null> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  const [page] = await db
    .select()
    .from(knowledgePages)
    .where(
      and(
        eq(knowledgePages.id, pageId),
        eq(knowledgePages.tenantId, session.tenantId)
      )
    )
    .limit(1);

  return page ?? null;
}

// ========================================
// 생성/수정/삭제
// ========================================

/**
 * 새 페이지 생성
 */
export async function createKnowledgePage(
  input: CreateKnowledgePageInput
): Promise<{ success: boolean; page?: KnowledgePage; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 부모 페이지 정보 조회 (있는 경우)
    let parentPath = '';
    let depth = 0;
    let sortOrder = 0;

    if (input.parentId) {
      const parent = await getKnowledgePage(input.parentId);
      if (parent) {
        parentPath = parent.path;
        depth = parent.depth + 1;
      }
    }

    // 같은 부모 아래 마지막 sortOrder 조회
    const siblings = await db
      .select({ sortOrder: knowledgePages.sortOrder })
      .from(knowledgePages)
      .where(
        and(
          eq(knowledgePages.chatbotId, input.chatbotId),
          eq(knowledgePages.tenantId, session.tenantId),
          input.parentId ? eq(knowledgePages.parentId, input.parentId) : isNull(knowledgePages.parentId)
        )
      )
      .orderBy(desc(knowledgePages.sortOrder))
      .limit(1);

    if (siblings.length > 0) {
      sortOrder = siblings[0].sortOrder + 1;
    }

    // 경로 생성 (예: /회사소개/팀원)
    const path = parentPath
      ? `${parentPath}/${input.title}`
      : `/${input.title}`;

    const newPage: NewKnowledgePage = {
      tenantId: session.tenantId,
      chatbotId: input.chatbotId,
      parentId: input.parentId ?? null,
      path,
      depth,
      sortOrder,
      title: input.title,
      content: input.content ?? '',
      status: 'draft',
      isIndexed: false,
      sourceDocumentId: input.sourceDocumentId ?? null,
    };

    const [created] = await db
      .insert(knowledgePages)
      .values(newPage)
      .returning();

    revalidatePath('/console/chatbot/blog');

    return { success: true, page: created };
  } catch (error) {
    console.error('페이지 생성 실패:', error);
    return { success: false, error: '페이지 생성에 실패했습니다.' };
  }
}

/**
 * 페이지 수정
 */
export async function updateKnowledgePage(
  pageId: string,
  input: UpdateKnowledgePageInput
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 페이지 소유권 확인
    const existing = await getKnowledgePage(pageId);
    if (!existing) {
      return { success: false, error: '페이지를 찾을 수 없습니다.' };
    }

    // 버전 시스템 도입으로 isIndexed 무효화 불필요
    // 발행된 버전은 versions 테이블에서 별도 관리됨
    await db
      .update(knowledgePages)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(knowledgePages.id, pageId));

    revalidatePath('/console/chatbot/blog');
    revalidatePath(`/console/chatbot/blog/${pageId}`);

    return { success: true };
  } catch (error) {
    console.error('페이지 수정 실패:', error);
    return { success: false, error: '페이지 수정에 실패했습니다.' };
  }
}

/**
 * 페이지 삭제 (하위 페이지도 함께 삭제)
 */
export async function deleteKnowledgePage(
  pageId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 페이지 소유권 확인
    const existing = await getKnowledgePage(pageId);
    if (!existing) {
      return { success: false, error: '페이지를 찾을 수 없습니다.' };
    }

    // 하위 페이지들도 모두 삭제 (path prefix로 찾기)
    const pathPrefix = existing.path;

    // 재귀적으로 모든 하위 페이지 삭제
    await deleteDescendants(pageId, session.tenantId);

    // 현재 페이지 삭제
    await db
      .delete(knowledgePages)
      .where(
        and(
          eq(knowledgePages.id, pageId),
          eq(knowledgePages.tenantId, session.tenantId)
        )
      );

    revalidatePath('/console/chatbot/blog');

    return { success: true };
  } catch (error) {
    console.error('페이지 삭제 실패:', error);
    return { success: false, error: '페이지 삭제에 실패했습니다.' };
  }
}


/**
 * 여러 페이지 일괄 삭제
 *
 * 선택된 페이지들과 그 하위 페이지들을 모두 삭제합니다.
 * 부모-자식이 동시에 선택된 경우 중복 삭제를 방지합니다.
 */
export async function deleteKnowledgePages(
  pageIds: string[]
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, deletedCount: 0, error: '인증이 필요합니다.' };
  }

  if (pageIds.length === 0) {
    return { success: false, deletedCount: 0, error: '삭제할 페이지가 없습니다.' };
  }

  try {
    // 선택된 페이지들의 정보를 조회
    const selectedPages = await db
      .select({ id: knowledgePages.id, path: knowledgePages.path })
      .from(knowledgePages)
      .where(
        and(
          inArray(knowledgePages.id, pageIds),
          eq(knowledgePages.tenantId, session.tenantId)
        )
      );

    if (selectedPages.length === 0) {
      return { success: false, deletedCount: 0, error: '삭제할 페이지를 찾을 수 없습니다.' };
    }

    // 부모-자식 중복 제거: 부모가 선택되면 자식은 자동으로 삭제되므로 제외
    const pathsToDelete = selectedPages.map((p) => p.path);
    const rootPagesToDelete = selectedPages.filter((page) => {
      // 다른 선택된 페이지의 하위 경로가 아닌 경우만 포함
      return !pathsToDelete.some(
        (otherPath) =>
          otherPath !== page.path && page.path.startsWith(otherPath + '/')
      );
    });

    let deletedCount = 0;

    // 각 루트 페이지에 대해 삭제 수행
    for (const page of rootPagesToDelete) {
      // 하위 페이지들 재귀 삭제
      await deleteDescendants(page.id, session.tenantId);

      // 현재 페이지 삭제
      await db
        .delete(knowledgePages)
        .where(
          and(
            eq(knowledgePages.id, page.id),
            eq(knowledgePages.tenantId, session.tenantId)
          )
        );

      deletedCount++;
    }

    revalidatePath('/console/chatbot/blog');

    return { success: true, deletedCount };
  } catch (error) {
    console.error('페이지 일괄 삭제 실패:', error);
    return { success: false, deletedCount: 0, error: '페이지 삭제에 실패했습니다.' };
  }
}

// ========================================
// 인덱싱 (발행)
// ========================================

/**
 * 페이지 발행 (버전 스냅샷 생성)
 *
 * Draft/Published 분리 아키텍처:
 * - knowledge_pages: Draft(작업본) - 편집 중인 내용
 * - knowledge_page_versions: Published 스냅샷 - 검색에 사용
 *
 * 발행 시 현재 Draft를 스냅샷으로 저장하고 임베딩 생성
 * 기존 발행 버전은 'history'로 변경 (FIFO로 오래된 것 삭제)
 */
export async function publishKnowledgePage(
  pageId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId || !session?.userId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const page = await getKnowledgePage(pageId);
    if (!page) {
      return { success: false, error: '페이지를 찾을 수 없습니다.' };
    }

    if (!page.content || page.content.trim().length === 0) {
      return { success: false, error: '콘텐츠가 비어있습니다.' };
    }

    // 1. 기존 'published' 버전을 'history'로 변경
    await db
      .update(knowledgePageVersions)
      .set({ versionType: 'history' })
      .where(
        and(
          eq(knowledgePageVersions.pageId, pageId),
          eq(knowledgePageVersions.versionType, 'published')
        )
      );

    // 2. 현재 최대 버전 번호 조회
    const [maxVersionResult] = await db
      .select({ maxVersion: sql<number>`COALESCE(MAX(${knowledgePageVersions.versionNumber}), 0)` })
      .from(knowledgePageVersions)
      .where(eq(knowledgePageVersions.pageId, pageId));

    const nextVersionNumber = (maxVersionResult?.maxVersion ?? 0) + 1;

    // 3. 임베딩 생성 (경로 + 제목 + 콘텐츠)
    const textForEmbedding = `${page.path}\n${page.title}\n\n${page.content}`;
    const embedding = await embedText(textForEmbedding, {
      tenantId: session.tenantId,
      chatbotId: page.chatbotId,
    });

    // 4. 새 'published' 버전 스냅샷 생성
    const newVersion: NewKnowledgePageVersion = {
      pageId,
      versionType: 'published',
      versionNumber: nextVersionNumber,
      title: page.title,
      content: page.content,
      path: page.path,
      embedding,
      summary: null, // TODO: AI 요약 추가
      publishedAt: new Date(),
      publishedBy: session.userId,
    };

    const [createdVersion] = await db
      .insert(knowledgePageVersions)
      .values(newVersion)
      .returning({ id: knowledgePageVersions.id });

    // 5. knowledge_pages의 publishedVersionId 업데이트
    await db
      .update(knowledgePages)
      .set({
        publishedVersionId: createdVersion.id,
        isIndexed: true,
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(knowledgePages.id, pageId));

    // 6. FIFO: 오래된 history 버전 삭제 (10개 초과 시)
    const MAX_HISTORY_VERSIONS = 10;
    const historyVersions = await db
      .select({ id: knowledgePageVersions.id })
      .from(knowledgePageVersions)
      .where(
        and(
          eq(knowledgePageVersions.pageId, pageId),
          eq(knowledgePageVersions.versionType, 'history')
        )
      )
      .orderBy(desc(knowledgePageVersions.versionNumber));

    if (historyVersions.length > MAX_HISTORY_VERSIONS) {
      const toDelete = historyVersions.slice(MAX_HISTORY_VERSIONS);
      for (const version of toDelete) {
        await db
          .delete(knowledgePageVersions)
          .where(eq(knowledgePageVersions.id, version.id));
      }
    }

    revalidatePath('/console/chatbot/blog');
    revalidatePath(`/console/chatbot/blog/${pageId}`);

    return { success: true };
  } catch (error) {
    console.error('페이지 발행 실패:', error);
    return { success: false, error: '페이지 발행에 실패했습니다.' };
  }
}

/**
 * 페이지 발행 취소 (버전 삭제)
 *
 * 'published' 버전을 삭제하여 검색에서 제외
 * 기존 history 버전은 유지 (필요시 복원 가능)
 */
export async function unpublishKnowledgePage(
  pageId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 1. 'published' 버전 삭제 (검색에서 제외)
    await db
      .delete(knowledgePageVersions)
      .where(
        and(
          eq(knowledgePageVersions.pageId, pageId),
          eq(knowledgePageVersions.versionType, 'published')
        )
      );

    // 2. knowledge_pages 상태 업데이트
    await db
      .update(knowledgePages)
      .set({
        publishedVersionId: null,
        isIndexed: false,
        status: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(knowledgePages.id, pageId));

    revalidatePath('/console/chatbot/blog');
    revalidatePath(`/console/chatbot/blog/${pageId}`);

    return { success: true };
  } catch (error) {
    console.error('페이지 발행 취소 실패:', error);
    return { success: false, error: '페이지 발행 취소에 실패했습니다.' };
  }
}

// ========================================
// 순서 변경
// ========================================

/**
 * 페이지 순서/부모 변경 (드래그앤드롭)
 */
export async function reorderKnowledgePage(
  pageId: string,
  newParentId: string | null,
  newSortOrder: number
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const page = await getKnowledgePage(pageId);
    if (!page) {
      return { success: false, error: '페이지를 찾을 수 없습니다.' };
    }

    // 새 부모 경로 계산
    let newPath = `/${page.title}`;
    let newDepth = 0;

    if (newParentId) {
      const newParent = await getKnowledgePage(newParentId);
      if (newParent) {
        newPath = `${newParent.path}/${page.title}`;
        newDepth = newParent.depth + 1;
      }
    }

    await db
      .update(knowledgePages)
      .set({
        parentId: newParentId,
        path: newPath,
        depth: newDepth,
        sortOrder: newSortOrder,
        updatedAt: new Date(),
      })
      .where(eq(knowledgePages.id, pageId));

    revalidatePath('/console/chatbot/blog');

    return { success: true };
  } catch (error) {
    console.error('페이지 순서 변경 실패:', error);
    return { success: false, error: '페이지 순서 변경에 실패했습니다.' };
  }
}

// ========================================
// 버전 히스토리
// ========================================

/**
 * 페이지의 모든 버전 조회 (발행된 버전 + 히스토리)
 *
 * 버전 목록을 버전 번호 역순으로 정렬하여 반환
 * 현재 발행 버전은 versionType: 'published'로 표시
 */
export async function getPageVersions(pageId: string): Promise<{
  success: boolean;
  versions?: Array<{
    id: string;
    versionNumber: number;
    versionType: 'published' | 'history';
    title: string;
    content: string;
    path: string;
    publishedAt: Date;
  }>;
  error?: string;
}> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 페이지 소유권 확인
    const page = await getKnowledgePage(pageId);
    if (!page) {
      return { success: false, error: '페이지를 찾을 수 없습니다.' };
    }

    // 모든 버전 조회 (버전 번호 역순)
    const versions = await db
      .select({
        id: knowledgePageVersions.id,
        versionNumber: knowledgePageVersions.versionNumber,
        versionType: knowledgePageVersions.versionType,
        title: knowledgePageVersions.title,
        content: knowledgePageVersions.content,
        path: knowledgePageVersions.path,
        publishedAt: knowledgePageVersions.publishedAt,
      })
      .from(knowledgePageVersions)
      .where(eq(knowledgePageVersions.pageId, pageId))
      .orderBy(desc(knowledgePageVersions.versionNumber));

    return {
      success: true,
      versions: versions.map((v) => ({
        ...v,
        versionType: v.versionType as 'published' | 'history',
      })),
    };
  } catch (error) {
    console.error('버전 목록 조회 실패:', error);
    return { success: false, error: '버전 목록을 불러오는데 실패했습니다.' };
  }
}

/**
 * 버전 복원 (선택한 버전의 콘텐츠를 Draft로 복사)
 *
 * 버전의 title, content를 knowledge_pages로 복사
 * 발행 상태는 변경하지 않음 (사용자가 확인 후 재발행)
 */
export async function restoreVersion(
  versionId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 버전 조회
    const [version] = await db
      .select()
      .from(knowledgePageVersions)
      .where(eq(knowledgePageVersions.id, versionId))
      .limit(1);

    if (!version) {
      return { success: false, error: '버전을 찾을 수 없습니다.' };
    }

    // 페이지 소유권 확인
    const page = await getKnowledgePage(version.pageId);
    if (!page) {
      return { success: false, error: '페이지를 찾을 수 없습니다.' };
    }

    // Draft에 버전 콘텐츠 복사
    await db
      .update(knowledgePages)
      .set({
        title: version.title,
        content: version.content,
        updatedAt: new Date(),
      })
      .where(eq(knowledgePages.id, version.pageId));

    revalidatePath('/console/chatbot/blog');
    revalidatePath(`/console/chatbot/blog/${version.pageId}`);

    return { success: true };
  } catch (error) {
    console.error('버전 복원 실패:', error);
    return { success: false, error: '버전 복원에 실패했습니다.' };
  }
}

/**
 * 현재 발행된 버전 조회 (Draft와 비교용)
 *
 * 페이지가 발행된 상태인 경우, 현재 발행 버전의 title/content를 반환
 * Draft와 비교하여 변경 여부를 확인하는데 사용
 */
export async function getPublishedVersion(pageId: string): Promise<{
  success: boolean;
  version?: { id: string; title: string; content: string };
  error?: string;
}> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 페이지 소유권 확인 및 publishedVersionId 조회
    const page = await getKnowledgePage(pageId);
    if (!page) {
      return { success: false, error: '페이지를 찾을 수 없습니다.' };
    }

    // 발행된 버전이 없는 경우
    if (!page.publishedVersionId) {
      return { success: true, version: undefined };
    }

    // 현재 발행 버전 조회
    const [publishedVersion] = await db
      .select({
        id: knowledgePageVersions.id,
        title: knowledgePageVersions.title,
        content: knowledgePageVersions.content,
      })
      .from(knowledgePageVersions)
      .where(eq(knowledgePageVersions.id, page.publishedVersionId))
      .limit(1);

    if (!publishedVersion) {
      return { success: true, version: undefined };
    }

    return {
      success: true,
      version: publishedVersion,
    };
  } catch (error) {
    console.error('발행 버전 조회 실패:', error);
    return { success: false, error: '발행 버전을 불러오는데 실패했습니다.' };
  }
}

// ========================================
// 헬퍼 함수
// ========================================

/**
 * 플랫 리스트를 트리 구조로 변환
 */
function buildTree(pages: KnowledgePage[]): KnowledgePageTreeNode[] {
  const map = new Map<string, KnowledgePageTreeNode>();
  const roots: KnowledgePageTreeNode[] = [];

  // 모든 페이지를 맵에 추가
  for (const page of pages) {
    map.set(page.id, {
      id: page.id,
      title: page.title,
      path: page.path,
      depth: page.depth,
      status: page.status,
      isIndexed: page.isIndexed,
      children: [],
    });
  }

  // 부모-자식 관계 설정
  for (const page of pages) {
    const node = map.get(page.id)!;
    if (page.parentId && map.has(page.parentId)) {
      map.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * 하위 페이지들 재귀 삭제
 */
async function deleteDescendants(parentId: string, tenantId: string): Promise<void> {
  const children = await db
    .select({ id: knowledgePages.id })
    .from(knowledgePages)
    .where(
      and(
        eq(knowledgePages.parentId, parentId),
        eq(knowledgePages.tenantId, tenantId)
      )
    );

  for (const child of children) {
    await deleteDescendants(child.id, tenantId);
    await db.delete(knowledgePages).where(eq(knowledgePages.id, child.id));
  }
}
