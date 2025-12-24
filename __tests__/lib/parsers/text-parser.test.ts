/**
 * 텍스트 파서 테스트
 */

import { describe, it, expect } from 'vitest';
import { parseText } from '@/lib/parsers/text-parser';

describe('parseText', () => {
  it('일반 텍스트를 파싱할 수 있다', async () => {
    const text = 'Hello, World!\nThis is a test.';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('Hello, World!\nThis is a test.');
    expect(result.metadata.format).toBe('plain');
    expect(result.metadata.lineCount).toBe(2);
  });

  it('마크다운 형식으로 파싱할 수 있다', async () => {
    const text = '# Title\n\nSome **bold** text.';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseText(buffer, 'markdown');

    expect(result.text).toBe('# Title\n\nSome **bold** text.');
    expect(result.metadata.format).toBe('markdown');
  });

  it('BOM을 제거한다', async () => {
    const textWithBom = '\uFEFFHello, World!';
    const buffer = Buffer.from(textWithBom, 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('Hello, World!');
  });

  it('Windows 줄바꿈을 Unix로 변환한다', async () => {
    const text = 'Line 1\r\nLine 2\r\nLine 3';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('Line 1\nLine 2\nLine 3');
  });

  it('연속된 공백을 정리한다', async () => {
    const text = 'Hello     World  !\t\tTest';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('Hello World ! Test');
  });

  it('연속된 줄바꿈을 2개로 제한한다', async () => {
    const text = 'Paragraph 1\n\n\n\n\nParagraph 2';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('Paragraph 1\n\nParagraph 2');
  });

  it('앞뒤 공백을 제거한다', async () => {
    const text = '   Hello World   ';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('Hello World');
  });

  it('빈 텍스트를 처리한다', async () => {
    const buffer = Buffer.from('', 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('');
    expect(result.metadata.charCount).toBe(0);
  });

  it('한글 텍스트를 올바르게 파싱한다', async () => {
    const text = '안녕하세요. 테스트입니다.\n한국어 텍스트입니다.';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parseText(buffer);

    expect(result.text).toBe('안녕하세요. 테스트입니다.\n한국어 텍스트입니다.');
    expect(result.metadata.lineCount).toBe(2);
  });
});
