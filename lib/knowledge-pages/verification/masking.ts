// lib/knowledge-pages/verification/masking.ts

/**
 * 민감정보 마스킹 유틸리티
 *
 * 개인정보 보호를 위해 텍스트에서 민감정보를 자동으로 탐지하고 마스킹합니다.
 * 전화번호, 이메일, 주민등록번호, 카드번호, 계좌번호를 지원합니다.
 */

export interface MaskingResult {
  maskedText: string;
  maskings: MaskingEntry[];
}

export interface MaskingEntry {
  type: 'phone' | 'email' | 'rrn' | 'card' | 'account';
  original: string;
  masked: string;
  startChar: number;
  endChar: number;
}

/**
 * 민감정보 자동 마스킹
 *
 * 텍스트에서 개인정보를 탐지하고 마스킹합니다.
 * 마스킹된 위치 정보도 함께 반환하여 필요 시 복원 가능합니다.
 */
export function maskSensitiveInfo(text: string): MaskingResult {
  let maskedText = text;
  const maskings: MaskingEntry[] = [];
  let offset = 0;

  // 1. 주민등록번호 마스킹 (13자리) - 먼저 처리해야 전화번호/계좌번호와 충돌 방지
  const rrnRegex = /(\d{6})([-\s]?)(\d{7})/g;
  maskedText = maskedText.replace(
    rrnRegex,
    (match, p1, separator, _p2, matchOffset) => {
      const masked = `${p1}${separator}*******`;
      maskings.push({
        type: 'rrn',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 2. 카드번호 마스킹 (16자리)
  const cardRegex = /(\d{4})([-\s]?)(\d{4})([-\s]?)(\d{4})([-\s]?)(\d{4})/g;
  maskedText = maskedText.replace(
    cardRegex,
    (match, p1, s1, _p2, s2, _p3, s3, p4, matchOffset) => {
      const masked = `${p1}${s1}****${s2}****${s3}${p4}`;
      maskings.push({
        type: 'card',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 3. 전화번호 마스킹
  const phoneRegex = /(0\d{1,2})([-.\s]?)(\d{3,4})([-.\s]?)(\d{4})/g;
  maskedText = maskedText.replace(
    phoneRegex,
    (match, p1, s1, _p2, s2, p3, matchOffset) => {
      // 이미 마스킹된 영역인지 확인
      if (isAlreadyMasked(matchOffset, match.length, maskings, offset)) {
        return match;
      }
      const masked = `${p1}${s1}****${s2}${p3}`;
      maskings.push({
        type: 'phone',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 4. 이메일 마스킹
  const emailRegex = /([\w.-]{2})([\w.-]*)(@[\w.-]+\.\w+)/g;
  maskedText = maskedText.replace(
    emailRegex,
    (match, p1, p2, p3, matchOffset) => {
      const maskedMiddle = '*'.repeat(Math.min(4, Math.max(2, p2.length)));
      const masked = `${p1}${maskedMiddle}${p3}`;
      maskings.push({
        type: 'email',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  // 5. 계좌번호 마스킹 (10-14자리 숫자)
  const accountRegex = /(\d{3,4})(\d{4,6})(\d{3,4})/g;
  maskedText = maskedText.replace(
    accountRegex,
    (match, p1, p2, p3, matchOffset) => {
      // 이미 마스킹된 영역인지 확인
      if (isAlreadyMasked(matchOffset, match.length, maskings, offset)) {
        return match;
      }
      const masked = `${p1}${'*'.repeat(p2.length)}${p3}`;
      maskings.push({
        type: 'account',
        original: match,
        masked,
        startChar: matchOffset - offset,
        endChar: matchOffset - offset + match.length,
      });
      offset += match.length - masked.length;
      return masked;
    }
  );

  return { maskedText, maskings };
}

/**
 * 특정 위치가 이미 마스킹된 영역인지 확인
 */
function isAlreadyMasked(
  offset: number,
  length: number,
  maskings: MaskingEntry[],
  currentOffset: number
): boolean {
  const adjustedStart = offset - currentOffset;
  const adjustedEnd = adjustedStart + length;

  return maskings.some(
    (m) => adjustedStart >= m.startChar && adjustedEnd <= m.endChar
  );
}

/**
 * 마스킹 해제 (권한 있는 사용자만)
 *
 * 마스킹된 텍스트와 마스킹 정보를 사용하여 원본 복원
 */
export function unmaskSensitiveInfo(
  maskedText: string,
  maskings: MaskingEntry[]
): string {
  // 역순으로 처리하여 위치가 변하지 않도록
  const sortedMaskings = [...maskings].sort(
    (a, b) => b.startChar - a.startChar
  );

  let unmaskedText = maskedText;

  for (const masking of sortedMaskings) {
    unmaskedText =
      unmaskedText.slice(0, masking.startChar) +
      masking.original +
      unmaskedText.slice(masking.startChar + masking.masked.length);
  }

  return unmaskedText;
}

/**
 * 민감정보 탐지 (마스킹 없이 탐지만)
 */
export function detectSensitiveInfo(text: string): {
  type: MaskingEntry['type'];
  text: string;
  startChar: number;
  endChar: number;
}[] {
  const detected: {
    type: MaskingEntry['type'];
    text: string;
    startChar: number;
    endChar: number;
  }[] = [];

  const patterns: { type: MaskingEntry['type']; regex: RegExp }[] = [
    { type: 'rrn', regex: /\d{6}[-\s]?\d{7}/g },
    { type: 'card', regex: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g },
    { type: 'phone', regex: /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g },
    { type: 'email', regex: /[\w.-]+@[\w.-]+\.\w+/g },
  ];

  for (const { type, regex } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // 값 추출 (클로저에서 null 가능성 제거)
      const matchIndex = match.index;
      const matchText = match[0];
      const matchLength = matchText.length;

      // 중복 탐지 방지
      const isDuplicate = detected.some(
        (d) =>
          (matchIndex >= d.startChar && matchIndex < d.endChar) ||
          (matchIndex + matchLength > d.startChar &&
            matchIndex + matchLength <= d.endChar)
      );

      if (!isDuplicate) {
        detected.push({
          type,
          text: matchText,
          startChar: matchIndex,
          endChar: matchIndex + matchLength,
        });
      }
    }
  }

  return detected.sort((a, b) => a.startChar - b.startChar);
}

/**
 * 마스킹 유형별 한글 라벨
 */
export const maskingTypeLabels: Record<MaskingEntry['type'], string> = {
  phone: '전화번호',
  email: '이메일',
  rrn: '주민등록번호',
  card: '카드번호',
  account: '계좌번호',
};
