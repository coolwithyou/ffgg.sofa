/**
 * 통합 문서 파서
 * 파일 타입에 따라 적절한 파서 선택
 */

import { parsePdf, type PdfParseResult } from './pdf-parser';
import { parseDocx, type DocxParseResult } from './docx-parser';
import { parseText, type TextParseResult } from './text-parser';
import { parseCsv, type CsvParseResult } from './csv-parser';

export type SupportedFileType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'text/markdown'
  | 'text/csv'
  | 'application/json';

export type DocumentParseResult = {
  text: string;
  fileType: SupportedFileType;
  metadata: Record<string, unknown>;
} & (
  | { type: 'pdf'; parseResult: PdfParseResult }
  | { type: 'docx'; parseResult: DocxParseResult }
  | { type: 'text'; parseResult: TextParseResult }
  | { type: 'csv'; parseResult: CsvParseResult }
  | { type: 'json'; parseResult: { data: unknown } }
);

/**
 * 파일 타입에 따라 적절한 파서 선택하여 문서 파싱
 */
export async function parseDocument(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<DocumentParseResult> {
  switch (fileType) {
    case 'application/pdf': {
      const parseResult = await parsePdf(buffer);
      return {
        text: parseResult.text,
        fileType,
        type: 'pdf',
        parseResult,
        metadata: parseResult.metadata,
      };
    }

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const parseResult = await parseDocx(buffer);
      return {
        text: parseResult.text,
        fileType,
        type: 'docx',
        parseResult,
        metadata: parseResult.metadata,
      };
    }

    case 'text/plain': {
      const parseResult = await parseText(buffer, 'plain');
      return {
        text: parseResult.text,
        fileType,
        type: 'text',
        parseResult,
        metadata: parseResult.metadata,
      };
    }

    case 'text/markdown': {
      const parseResult = await parseText(buffer, 'markdown');
      return {
        text: parseResult.text,
        fileType,
        type: 'text',
        parseResult,
        metadata: parseResult.metadata,
      };
    }

    case 'text/csv': {
      const parseResult = await parseCsv(buffer);
      return {
        text: parseResult.text,
        fileType,
        type: 'csv',
        parseResult,
        metadata: {
          ...parseResult.metadata,
          data: parseResult.data,
        },
      };
    }

    case 'application/json': {
      const jsonResult = parseJson(buffer);
      return {
        text: jsonResult.text,
        fileType,
        type: 'json',
        parseResult: { data: jsonResult.data },
        metadata: { structure: typeof jsonResult.data },
      };
    }

    default:
      throw new Error(`지원하지 않는 파일 타입: ${fileType}`);
  }
}

/**
 * JSON 파싱
 */
function parseJson(buffer: Buffer): { text: string; data: unknown } {
  try {
    let content = buffer.toString('utf-8');

    // BOM 제거
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const data = JSON.parse(content);
    const text = jsonToText(data);

    return { text, data };
  } catch (error) {
    throw new Error(
      `JSON 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}

/**
 * JSON을 텍스트로 변환 (RAG용)
 */
function jsonToText(data: unknown, prefix = ''): string {
  if (data === null || data === undefined) {
    return '';
  }

  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return prefix ? `${prefix}: ${data}` : String(data);
  }

  if (Array.isArray(data)) {
    return data
      .map((item, index) => jsonToText(item, prefix ? `${prefix}[${index}]` : `[${index}]`))
      .filter(Boolean)
      .join('\n');
  }

  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([key, value]) => jsonToText(value, prefix ? `${prefix}.${key}` : key))
      .filter(Boolean)
      .join('\n');
  }

  return '';
}
