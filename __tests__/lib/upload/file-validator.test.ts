import { describe, it, expect } from 'vitest';
import {
  sanitizeFilename,
  isAllowedMimeType,
  getMimeTypeFromExtension,
} from '@/lib/upload/file-validator';

describe('File Validator', () => {
  describe('sanitizeFilename', () => {
    it('should remove path traversal characters', () => {
      // 슬래시는 _로 변환되고, 앞의 점들은 제거됨
      const result1 = sanitizeFilename('../../../etc/passwd');
      expect(result1).not.toContain('/');
      expect(result1).not.toContain('\\');
      expect(result1).not.toMatch(/^\./); // 앞에 점으로 시작하지 않음

      const result2 = sanitizeFilename('..\\..\\windows\\system32');
      expect(result2).not.toContain('/');
      expect(result2).not.toContain('\\');
    });

    it('should remove leading dots (hidden files)', () => {
      expect(sanitizeFilename('.hidden_file.txt')).toBe('hidden_file.txt');
      expect(sanitizeFilename('...multiple_dots.txt')).toBe('multiple_dots.txt');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('file<script>.txt')).toBe('file_script_.txt');
      expect(sanitizeFilename('file|name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('file:name.txt')).toBe('file_name.txt');
    });

    it('should handle empty filenames', () => {
      expect(sanitizeFilename('')).toBe('unnamed_file');
      expect(sanitizeFilename('   ')).toBe('unnamed_file');
      expect(sanitizeFilename('...')).toBe('unnamed_file');
    });

    it('should preserve valid filenames', () => {
      expect(sanitizeFilename('my_document.pdf')).toBe('my_document.pdf');
      expect(sanitizeFilename('report-2024.xlsx')).toBe('report-2024.xlsx');
    });

    it('should truncate long filenames while preserving extension', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.pdf')).toBe(true);
    });
  });

  describe('isAllowedMimeType', () => {
    it('should accept allowed MIME types', () => {
      expect(isAllowedMimeType('application/pdf')).toBe(true);
      expect(isAllowedMimeType('text/plain')).toBe(true);
      expect(isAllowedMimeType('application/json')).toBe(true);
    });

    it('should reject disallowed MIME types', () => {
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
      expect(isAllowedMimeType('application/javascript')).toBe(false);
      expect(isAllowedMimeType('image/png')).toBe(false);
    });
  });

  describe('getMimeTypeFromExtension', () => {
    it('should return correct MIME type for known extensions', () => {
      expect(getMimeTypeFromExtension('.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('.txt')).toBe('text/plain');
      expect(getMimeTypeFromExtension('.docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('should handle uppercase extensions', () => {
      expect(getMimeTypeFromExtension('.PDF')).toBe('application/pdf');
      expect(getMimeTypeFromExtension('.TXT')).toBe('text/plain');
    });

    it('should return null for unknown extensions', () => {
      expect(getMimeTypeFromExtension('.exe')).toBeNull();
      expect(getMimeTypeFromExtension('.unknown')).toBeNull();
    });
  });
});
