/**
 * CSV 파서
 * papaparse 라이브러리를 사용하여 CSV/TSV 파일 파싱
 */

import Papa from 'papaparse';

export interface CsvParseResult {
  text: string;
  data: Record<string, string>[];
  metadata: {
    rowCount: number;
    columnCount: number;
    headers: string[];
    errors: string[];
  };
}

/**
 * CSV 버퍼에서 데이터 추출
 */
export async function parseCsv(buffer: Buffer): Promise<CsvParseResult> {
  try {
    // UTF-8로 디코딩
    let content = buffer.toString('utf-8');

    // BOM 제거
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    // CSV 파싱
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    });

    const headers = result.meta.fields || [];
    const data = result.data;

    // 텍스트 형식으로 변환 (RAG용)
    const text = convertToText(headers, data);

    return {
      text,
      data,
      metadata: {
        rowCount: data.length,
        columnCount: headers.length,
        headers,
        errors: result.errors.map((e) => e.message),
      },
    };
  } catch (error) {
    throw new Error(
      `CSV 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}

/**
 * CSV 데이터를 RAG에 적합한 텍스트 형식으로 변환
 */
function convertToText(
  headers: string[],
  data: Record<string, string>[]
): string {
  if (data.length === 0) {
    return '';
  }

  // 각 행을 "헤더: 값" 형식으로 변환
  const textRows = data.map((row, index) => {
    const rowText = headers
      .map((header) => {
        const value = row[header];
        if (value && value.trim()) {
          return `${header}: ${value}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');

    return `[Row ${index + 1}]\n${rowText}`;
  });

  return textRows.join('\n\n');
}
