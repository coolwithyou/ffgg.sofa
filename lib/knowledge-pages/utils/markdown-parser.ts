/**
 * 마크다운 파싱 유틸리티
 *
 * 마크다운 파일을 헤딩 기반으로 구조화된 섹션으로 파싱합니다.
 * LLM을 사용하지 않고 순수 파싱 로직으로 동작합니다.
 *
 * 주요 기능:
 * - YAML 프론트매터 파싱
 * - ## 헤딩 기준 페이지 분할
 * - 계층 구조 유지 (###, #### 등은 해당 섹션의 하위 콘텐츠로 포함)
 * - 코드 블록 내 # 문자 무시
 * - 중복 제목 처리 (slug에 인덱스 추가)
 */

/**
 * 마크다운 섹션 (페이지로 변환될 단위)
 */
export interface MarkdownSection {
  /** slug 형태 ID (예: "installation", "quick-start") */
  id: string;
  /** 헤딩 텍스트 */
  title: string;
  /** 헤딩 레벨 (1-6) */
  level: number;
  /** 해당 섹션의 마크다운 콘텐츠 */
  content: string;
  /** 하위 섹션 (현재 구현에서는 사용 안 함, 확장용) */
  children: MarkdownSection[];
}

/**
 * 파싱된 마크다운 구조
 */
export interface ParsedMarkdown {
  /** 문서 제목 (프론트매터 title 또는 첫 # 헤딩 또는 파일명) */
  title: string;
  /** 문서 설명 (프론트매터 description) */
  description?: string;
  /** ## 헤딩 기준으로 분할된 섹션들 */
  sections: MarkdownSection[];
  /** 프론트매터 제외한 원본 마크다운 */
  fullContent: string;
  /** # 레벨 헤딩 전 콘텐츠 (있는 경우) */
  preamble?: string;
}

/**
 * 프론트매터 파싱 결과
 */
export interface FrontmatterResult {
  /** 파싱된 프론트매터 (없으면 null) */
  frontmatter: Record<string, string> | null;
  /** 프론트매터 제외한 콘텐츠 */
  content: string;
}

/**
 * YAML 프론트매터 파싱
 *
 * 마크다운 시작 부분의 ---로 감싼 YAML 블록을 파싱합니다.
 *
 * @example
 * ```markdown
 * ---
 * title: 설치 가이드
 * description: 프로젝트 설치 방법
 * ---
 *
 * # 설치 가이드
 * ```
 */
export function parseFrontmatter(markdown: string): FrontmatterResult {
  const trimmed = markdown.trim();

  // 프론트매터 시작 확인
  if (!trimmed.startsWith('---')) {
    return { frontmatter: null, content: markdown };
  }

  // 종료 --- 찾기
  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter: null, content: markdown };
  }

  const yamlContent = trimmed.slice(3, endIndex).trim();
  const restContent = trimmed.slice(endIndex + 3).trim();

  // 간단한 YAML 파싱 (key: value 형태만 지원)
  const frontmatter: Record<string, string> = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // 따옴표 제거
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && value) {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null,
    content: restContent,
  };
}

/**
 * 한글/특수문자를 slug로 변환
 *
 * @example
 * generateSlugId("설치 가이드") → "installation-guide" (실제로는 랜덤 해시 추가)
 * generateSlugId("Quick Start!") → "quick-start"
 */
export function generateSlugId(title: string, existingIds: Set<string> = new Set()): string {
  // 기본 slug 생성
  let slug = title
    .toLowerCase()
    .trim()
    // 한글은 그대로 유지 (나중에 transliteration 추가 가능)
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // 문자, 숫자, 공백, 하이픈만 유지
    .replace(/\s+/g, '-') // 공백 → 하이픈
    .replace(/-+/g, '-') // 중복 하이픈 제거
    .replace(/^-|-$/g, ''); // 앞뒤 하이픈 제거

  // 빈 문자열인 경우 기본값
  if (!slug) {
    slug = 'section';
  }

  // 중복 처리
  let finalSlug = slug;
  let counter = 1;
  while (existingIds.has(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  existingIds.add(finalSlug);
  return finalSlug;
}

/**
 * 코드 블록을 임시 플레이스홀더로 대체
 *
 * 코드 블록 내의 # 문자가 헤딩으로 인식되지 않도록 합니다.
 */
function replaceCodeBlocks(
  markdown: string
): { processed: string; codeBlocks: string[] } {
  const codeBlocks: string[] = [];
  const PLACEHOLDER = '___CODE_BLOCK_PLACEHOLDER___';

  // 펜스드 코드 블록 (```)
  const processed = markdown.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `${PLACEHOLDER}${codeBlocks.length - 1}${PLACEHOLDER}`;
  });

  return { processed, codeBlocks };
}

/**
 * 코드 블록 플레이스홀더를 원본으로 복원
 */
function restoreCodeBlocks(content: string, codeBlocks: string[]): string {
  const PLACEHOLDER = '___CODE_BLOCK_PLACEHOLDER___';
  return content.replace(
    new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, 'g'),
    (_, index) => codeBlocks[parseInt(index, 10)]
  );
}

/**
 * 마크다운 헤딩 파싱
 *
 * ## 레벨 헤딩을 기준으로 섹션을 분할합니다.
 * # 레벨은 문서 제목으로 사용되고, ### 이하는 해당 섹션의 하위 콘텐츠로 포함됩니다.
 *
 * @param markdown - 파싱할 마크다운 (프론트매터 제외)
 * @param filename - 파일명 (제목 폴백용)
 */
export function parseMarkdownStructure(
  markdown: string,
  filename?: string
): ParsedMarkdown {
  // 1. 프론트매터 파싱
  const { frontmatter, content } = parseFrontmatter(markdown);

  // 2. 코드 블록 임시 대체
  const { processed, codeBlocks } = replaceCodeBlocks(content);

  // 3. 라인별 파싱
  const lines = processed.split('\n');
  const sections: MarkdownSection[] = [];
  const existingIds = new Set<string>();

  let documentTitle = frontmatter?.title || '';
  let documentDescription = frontmatter?.description;
  let preamble = ''; // # 헤딩 전 콘텐츠
  let currentSection: MarkdownSection | null = null;
  let currentContent: string[] = [];
  let foundFirstH1 = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      if (level === 1) {
        // # 레벨: 문서 제목으로 사용
        if (!foundFirstH1) {
          foundFirstH1 = true;
          if (!documentTitle) {
            documentTitle = title;
          }
          // # 전까지의 콘텐츠를 preamble로 저장
          if (currentContent.length > 0) {
            preamble = restoreCodeBlocks(currentContent.join('\n').trim(), codeBlocks);
          }
          currentContent = [];
        } else {
          // 두 번째 이후 #은 일반 콘텐츠로 취급
          currentContent.push(line);
        }
      } else if (level === 2) {
        // ## 레벨: 새 섹션 시작
        if (currentSection) {
          // 이전 섹션 저장
          currentSection.content = restoreCodeBlocks(
            currentContent.join('\n').trim(),
            codeBlocks
          );
          sections.push(currentSection);
        } else if (currentContent.length > 0 && !foundFirstH1) {
          // # 없이 ## 먼저 나온 경우, 이전 콘텐츠를 preamble로
          preamble = restoreCodeBlocks(currentContent.join('\n').trim(), codeBlocks);
        }

        currentSection = {
          id: generateSlugId(title, existingIds),
          title,
          level,
          content: '',
          children: [],
        };
        currentContent = [];
      } else {
        // ### 이하: 현재 섹션의 콘텐츠로 포함
        currentContent.push(line);
      }
    } else {
      currentContent.push(line);
    }
  }

  // 마지막 섹션 저장
  if (currentSection) {
    currentSection.content = restoreCodeBlocks(
      currentContent.join('\n').trim(),
      codeBlocks
    );
    sections.push(currentSection);
  } else if (currentContent.length > 0) {
    // 섹션이 없는 경우 (## 없는 마크다운)
    // 전체를 하나의 섹션으로
    const title = documentTitle || filename?.replace('.md', '') || '문서';
    sections.push({
      id: generateSlugId(title, existingIds),
      title,
      level: 2,
      content: restoreCodeBlocks(
        currentContent.join('\n').trim(),
        codeBlocks
      ),
      children: [],
    });
  }

  // 최종 제목 결정
  if (!documentTitle) {
    documentTitle = filename?.replace('.md', '') || '문서';
  }

  return {
    title: documentTitle,
    description: documentDescription,
    sections,
    fullContent: content,
    preamble: preamble || undefined,
  };
}

/**
 * ParsedMarkdown을 GeneratedPage[] 형식으로 변환
 *
 * document-to-pages.ts의 savePagesToDatabase()와 호환되는 형식으로 변환합니다.
 */
export function convertToGeneratedPages(
  parsed: ParsedMarkdown
): import('../types').GeneratedPage[] {
  return parsed.sections.map((section) => ({
    id: section.id,
    title: section.title,
    content: section.content,
    sourcePages: [], // 마크다운 직접 업로드는 원본 페이지 참조 없음
    confidence: 1.0, // 직접 업로드는 신뢰도 100%
    children: [], // 현재는 평탄한 구조
  }));
}
