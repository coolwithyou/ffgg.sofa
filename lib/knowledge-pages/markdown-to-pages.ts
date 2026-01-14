/**
 * 마크다운 → Knowledge Pages 직접 저장
 *
 * 외부 LLM으로 이미 마크다운으로 변환된 파일을
 * LLM 변환 과정 없이 바로 Knowledge Pages로 저장합니다.
 *
 * 처리 흐름:
 * 1. 마크다운 파싱 (프론트매터 + 헤딩 구조)
 * 2. ## 헤딩 기준 섹션 분할
 * 3. 각 섹션을 Knowledge Page로 저장 (Draft 상태)
 */

import { createKnowledgePage } from '@/app/(console)/console/chatbot/blog/actions';
import { logger } from '@/lib/logger';
import {
  parseMarkdownStructure,
  convertToGeneratedPages,
} from './utils/markdown-parser';
import type { GeneratedPage } from './types';

/**
 * 마크다운 업로드 옵션
 */
export interface MarkdownUploadOptions {
  /** 챗봇 ID */
  chatbotId: string;
  /** 상위 페이지 ID (선택) */
  parentPageId?: string;
}

/**
 * 마크다운 업로드 결과
 */
export interface MarkdownUploadResult {
  /** 성공 여부 */
  success: boolean;
  /** 생성된 페이지 수 */
  pageCount: number;
  /** 루트 페이지 ID (첫 번째 페이지) */
  rootPageId?: string;
  /** 생성된 페이지 목록 */
  pages?: Array<{ id: string; title: string }>;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 마크다운을 Knowledge Pages로 직접 저장
 *
 * @param markdownContent - 마크다운 파일 내용
 * @param filename - 파일명 (제목 폴백용)
 * @param options - 업로드 옵션
 * @returns 업로드 결과
 *
 * @example
 * ```typescript
 * const result = await uploadMarkdownToPages(
 *   markdownContent,
 *   'guide.md',
 *   { chatbotId: 'xxx', parentPageId: 'yyy' }
 * );
 *
 * if (result.success) {
 *   console.log(`${result.pageCount}개 페이지 생성됨`);
 * }
 * ```
 */
export async function uploadMarkdownToPages(
  markdownContent: string,
  filename: string,
  options: MarkdownUploadOptions
): Promise<MarkdownUploadResult> {
  const { chatbotId, parentPageId } = options;

  try {
    // 1. 마크다운 파싱
    logger.info('[MarkdownToPages] Starting markdown parsing', {
      chatbotId,
      filename,
      contentLength: markdownContent.length,
    });

    const parsed = parseMarkdownStructure(markdownContent, filename);

    logger.info('[MarkdownToPages] Markdown parsed', {
      title: parsed.title,
      sectionCount: parsed.sections.length,
      hasDescription: !!parsed.description,
      hasPreamble: !!parsed.preamble,
    });

    // 2. 섹션이 없는 경우 처리
    if (parsed.sections.length === 0) {
      logger.warn('[MarkdownToPages] No sections found, creating single page');

      const result = await createKnowledgePage({
        chatbotId,
        parentId: parentPageId ?? null,
        title: parsed.title,
        content: parsed.fullContent,
      });

      if (result.success && result.page) {
        return {
          success: true,
          pageCount: 1,
          rootPageId: result.page.id,
          pages: [{ id: result.page.id, title: parsed.title }],
        };
      }

      return {
        success: false,
        pageCount: 0,
        error: result.error || '페이지 생성에 실패했습니다.',
      };
    }

    // 3. GeneratedPage 형식으로 변환
    const generatedPages = convertToGeneratedPages(parsed);

    // 4. Preamble이 있는 경우, 첫 번째 섹션에 포함
    if (parsed.preamble && generatedPages.length > 0) {
      generatedPages[0].content = `${parsed.preamble}\n\n${generatedPages[0].content}`;
    }

    // 5. 페이지 저장
    const savedPages: Array<{ id: string; title: string }> = [];
    let rootPageId: string | undefined;

    await savePagesFromMarkdown(
      generatedPages,
      chatbotId,
      parentPageId ?? null,
      savedPages
    );

    if (savedPages.length > 0) {
      rootPageId = savedPages[0].id;
    }

    logger.info('[MarkdownToPages] Pages saved successfully', {
      chatbotId,
      pageCount: savedPages.length,
      rootPageId,
    });

    return {
      success: true,
      pageCount: savedPages.length,
      rootPageId,
      pages: savedPages,
    };
  } catch (error) {
    logger.error(
      '[MarkdownToPages] Failed to upload markdown',
      error instanceof Error ? error : new Error(String(error)),
      { chatbotId, filename }
    );

    return {
      success: false,
      pageCount: 0,
      error:
        error instanceof Error
          ? error.message
          : '마크다운 업로드 중 오류가 발생했습니다.',
    };
  }
}

/**
 * GeneratedPage[] → Knowledge Pages 저장 (재귀)
 *
 * document-to-pages.ts의 savePagesToDatabase()와 유사하지만,
 * 저장된 페이지 정보를 수집하여 반환합니다.
 */
async function savePagesFromMarkdown(
  pages: GeneratedPage[],
  chatbotId: string,
  parentId: string | null,
  savedPages: Array<{ id: string; title: string }>
): Promise<void> {
  for (const page of pages) {
    const result = await createKnowledgePage({
      chatbotId,
      parentId,
      title: page.title,
      content: page.content,
    });

    if (result.success && result.page) {
      savedPages.push({ id: result.page.id, title: page.title });

      // 하위 페이지가 있는 경우 재귀 저장
      if (page.children.length > 0) {
        await savePagesFromMarkdown(
          page.children,
          chatbotId,
          result.page.id,
          savedPages
        );
      }
    } else {
      logger.error(
        '[MarkdownToPages] Failed to create page',
        new Error(result.error || 'Unknown error'),
        { title: page.title }
      );
      // 하나의 페이지 실패해도 나머지 계속 진행
    }
  }
}

/**
 * 마크다운 파일 유효성 검사
 *
 * @param content - 마크다운 내용
 * @returns 유효성 검사 결과
 */
export function validateMarkdownContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: '빈 마크다운 파일입니다.' };
  }

  // 최소 길이 체크 (너무 짧은 파일 방지)
  if (content.trim().length < 10) {
    return { valid: false, error: '마크다운 내용이 너무 짧습니다.' };
  }

  return { valid: true };
}
