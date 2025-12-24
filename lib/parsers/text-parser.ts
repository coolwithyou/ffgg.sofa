/**
 * 텍스트/마크다운 파서
 * TXT, MD 파일에서 텍스트 추출
 */

export interface TextParseResult {
  text: string;
  metadata: {
    format: 'plain' | 'markdown';
    lineCount: number;
    charCount: number;
  };
}

/**
 * 텍스트 버퍼에서 내용 추출
 */
export async function parseText(
  buffer: Buffer,
  format: 'plain' | 'markdown' = 'plain'
): Promise<TextParseResult> {
  try {
    // UTF-8로 디코딩
    let text = buffer.toString('utf-8');

    // BOM 제거
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const cleanedText = cleanText(text);

    return {
      text: cleanedText,
      metadata: {
        format,
        lineCount: cleanedText.split('\n').length,
        charCount: cleanedText.length,
      },
    };
  } catch (error) {
    throw new Error(
      `텍스트 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}

/**
 * 텍스트 정리
 */
function cleanText(text: string): string {
  return (
    text
      // Windows 줄바꿈을 Unix로 통일
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 연속된 공백을 단일 공백으로 (탭 포함)
      .replace(/[ \t]+/g, ' ')
      // 3개 이상의 연속 줄바꿈을 2개로
      .replace(/\n{3,}/g, '\n\n')
      // 줄 앞뒤 공백 제거
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // 앞뒤 공백 제거
      .trim()
  );
}
