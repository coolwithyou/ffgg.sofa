import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  isPasswordChangeRequired,
  daysUntilPasswordExpiry,
  isWeakPassword,
  getPasswordStrength,
} from '@/lib/auth/password';

describe('Password Validation', () => {
  describe('validatePassword', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePassword('Abc1!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('비밀번호는 최소 8자리 이상이어야 합니다.');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = validatePassword('abcdef1!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('영문 대문자를 1개 이상 포함해야 합니다.');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = validatePassword('ABCDEF1!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('영문 소문자를 1개 이상 포함해야 합니다.');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('Abcdefgh!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('숫자를 1개 이상 포함해야 합니다.');
    });

    it('should reject passwords without special characters', () => {
      const result = validatePassword('Abcdefgh123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('특수문자를 1개 이상 포함해야 합니다.');
    });

    it('should accept valid passwords', () => {
      const result = validatePassword('Abcdef1!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept strong passwords', () => {
      const result = validatePassword('MyStr0ng!P@ssw0rd');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isPasswordChangeRequired', () => {
    it('should return true when lastChangedAt is null', () => {
      expect(isPasswordChangeRequired(null)).toBe(true);
    });

    it('should return true when password is older than 90 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      expect(isPasswordChangeRequired(oldDate)).toBe(true);
    });

    it('should return false when password is less than 90 days old', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      expect(isPasswordChangeRequired(recentDate)).toBe(false);
    });

    it('should return false when password was just changed', () => {
      expect(isPasswordChangeRequired(new Date())).toBe(false);
    });
  });

  describe('daysUntilPasswordExpiry', () => {
    it('should return 0 when lastChangedAt is null', () => {
      expect(daysUntilPasswordExpiry(null)).toBe(0);
    });

    it('should return 0 when password is already expired', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      expect(daysUntilPasswordExpiry(oldDate)).toBe(0);
    });

    it('should return correct days remaining', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      expect(daysUntilPasswordExpiry(thirtyDaysAgo)).toBe(60);
    });
  });

  describe('isWeakPassword', () => {
    it('should detect repeated characters', () => {
      expect(isWeakPassword('aaaaaaaa')).toBe(true);
    });

    it('should detect sequential numbers', () => {
      expect(isWeakPassword('123456Ab!')).toBe(true);
    });

    it('should detect common patterns', () => {
      expect(isWeakPassword('password123!')).toBe(true);
      expect(isWeakPassword('admin123!A')).toBe(true);
      expect(isWeakPassword('qwerty123!A')).toBe(true);
    });

    it('should accept strong passwords', () => {
      expect(isWeakPassword('Xk9#mP2$vL')).toBe(false);
    });
  });

  describe('getPasswordStrength', () => {
    it('should return score between 0 and 100', () => {
      const score = getPasswordStrength('Ab1!');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give higher score for complete passwords', () => {
      // 모든 조건 충족 (대문자, 소문자, 숫자, 특수문자)
      const completeScore = getPasswordStrength('Abcd1!@#');
      // 일부 조건만 충족
      const partialScore = getPasswordStrength('abcd1234');
      expect(completeScore).toBeGreaterThan(partialScore);
    });

    it('should penalize weak patterns', () => {
      const weakScore = getPasswordStrength('password123!A');
      const strongScore = getPasswordStrength('Xk9#mP2$vLqW');
      expect(strongScore).toBeGreaterThan(weakScore);
    });

    it('should give high score for very strong passwords', () => {
      const score = getPasswordStrength('MyV3ry$tr0ng!P@ssw0rd');
      expect(score).toBeGreaterThanOrEqual(80);
    });
  });
});
