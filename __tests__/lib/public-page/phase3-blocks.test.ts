/**
 * Phase 3 블록 테스트
 *
 * SOFA 차별화 블록들의 팩토리 함수 및 타입을 검증합니다:
 * - AI Chat Preview (AI 대화 미리보기)
 * - Knowledge Base Link (지식 베이스 링크)
 * - FAQ Quick Actions (FAQ 빠른 액션)
 * - Conversation Starter (대화 시작 프롬프트)
 * - Operating Hours (운영 시간)
 */

import { describe, it, expect } from 'vitest';
import {
  BlockType,
  BLOCK_FACTORIES,
  BLOCK_METAS,
  createAiChatPreviewBlock,
  createKnowledgeBaseLinkBlock,
  createFaqQuickActionsBlock,
  createConversationStarterBlock,
  createOperatingHoursBlock,
  type AiChatPreviewBlock,
  type KnowledgeBaseLinkBlock,
  type FaqQuickActionsBlock,
  type ConversationStarterBlock,
  type OperatingHoursBlock,
} from '@/lib/public-page/block-types';

describe('Phase 3 블록 (SOFA 차별화)', () => {
  describe('AI Chat Preview Block', () => {
    it('팩토리 함수가 올바른 기본값으로 블록을 생성해야 함', () => {
      const block = createAiChatPreviewBlock('test-id', 0);

      expect(block.id).toBe('test-id');
      expect(block.type).toBe(BlockType.AI_CHAT_PREVIEW);
      expect(block.order).toBe(0);
      expect(block.visible).toBe(true);
    });

    it('기본 대화 내용이 포함되어야 함', () => {
      const block = createAiChatPreviewBlock('test-id', 0);

      expect(block.config.conversations).toHaveLength(2);
      expect(block.config.conversations[0].role).toBe('user');
      expect(block.config.conversations[1].role).toBe('assistant');
    });

    it('타이핑 애니메이션이 기본적으로 활성화되어야 함', () => {
      const block = createAiChatPreviewBlock('test-id', 0);

      expect(block.config.showTypingAnimation).toBe(true);
    });

    it('BLOCK_FACTORIES에 등록되어 있어야 함', () => {
      expect(BLOCK_FACTORIES).toHaveProperty(BlockType.AI_CHAT_PREVIEW);

      const createdBlock = BLOCK_FACTORIES[BlockType.AI_CHAT_PREVIEW]('factory-id', 5);
      expect(createdBlock.type).toBe(BlockType.AI_CHAT_PREVIEW);
      expect(createdBlock.order).toBe(5);
    });

    it('BLOCK_METAS에 메타 정보가 있어야 함', () => {
      expect(BLOCK_METAS).toHaveProperty(BlockType.AI_CHAT_PREVIEW);
      expect(BLOCK_METAS[BlockType.AI_CHAT_PREVIEW].name).toBeDefined();
      expect(BLOCK_METAS[BlockType.AI_CHAT_PREVIEW].icon).toBeDefined();
    });
  });

  describe('Knowledge Base Link Block', () => {
    it('팩토리 함수가 올바른 기본값으로 블록을 생성해야 함', () => {
      const block = createKnowledgeBaseLinkBlock('kb-id', 1);

      expect(block.id).toBe('kb-id');
      expect(block.type).toBe(BlockType.KNOWLEDGE_BASE_LINK);
      expect(block.order).toBe(1);
      expect(block.visible).toBe(true);
    });

    it('documentId가 빈 문자열로 초기화되어야 함', () => {
      const block = createKnowledgeBaseLinkBlock('kb-id', 1);

      expect(block.config.documentId).toBe('');
    });

    it('미리보기가 기본적으로 활성화되어야 함', () => {
      const block = createKnowledgeBaseLinkBlock('kb-id', 1);

      expect(block.config.showPreview).toBe(true);
    });

    it('title은 빈 문자열로 초기화되어야 함', () => {
      const block = createKnowledgeBaseLinkBlock('kb-id', 1);

      expect(block.config.title).toBe('');
    });

    it('BLOCK_FACTORIES에 등록되어 있어야 함', () => {
      expect(BLOCK_FACTORIES).toHaveProperty(BlockType.KNOWLEDGE_BASE_LINK);
    });
  });

  describe('FAQ Quick Actions Block', () => {
    it('팩토리 함수가 올바른 기본값으로 블록을 생성해야 함', () => {
      const block = createFaqQuickActionsBlock('faq-id', 2);

      expect(block.id).toBe('faq-id');
      expect(block.type).toBe(BlockType.FAQ_QUICK_ACTIONS);
      expect(block.order).toBe(2);
      expect(block.visible).toBe(true);
    });

    it('기본 질문 목록이 포함되어야 함', () => {
      const block = createFaqQuickActionsBlock('faq-id', 2);

      expect(block.config.questions).toBeDefined();
      expect(Array.isArray(block.config.questions)).toBe(true);
      expect(block.config.questions.length).toBeGreaterThan(0);
    });

    it('각 질문에 text 필드가 있어야 함', () => {
      const block = createFaqQuickActionsBlock('faq-id', 2);

      block.config.questions.forEach((question) => {
        expect(question).toHaveProperty('text');
        expect(typeof question.text).toBe('string');
      });
    });

    it('기본 레이아웃이 buttons여야 함', () => {
      const block = createFaqQuickActionsBlock('faq-id', 2);

      expect(block.config.layout).toBe('buttons');
    });

    it('BLOCK_FACTORIES에 등록되어 있어야 함', () => {
      expect(BLOCK_FACTORIES).toHaveProperty(BlockType.FAQ_QUICK_ACTIONS);
    });
  });

  describe('Conversation Starter Block', () => {
    it('팩토리 함수가 올바른 기본값으로 블록을 생성해야 함', () => {
      const block = createConversationStarterBlock('cs-id', 3);

      expect(block.id).toBe('cs-id');
      expect(block.type).toBe(BlockType.CONVERSATION_STARTER);
      expect(block.order).toBe(3);
      expect(block.visible).toBe(true);
    });

    it('기본 프롬프트 목록이 포함되어야 함', () => {
      const block = createConversationStarterBlock('cs-id', 3);

      expect(block.config.prompts).toBeDefined();
      expect(Array.isArray(block.config.prompts)).toBe(true);
      expect(block.config.prompts.length).toBeGreaterThan(0);
    });

    it('기본 스타일이 card여야 함', () => {
      const block = createConversationStarterBlock('cs-id', 3);

      expect(block.config.style).toBe('card');
    });

    it('랜덤화가 기본적으로 비활성화되어야 함', () => {
      const block = createConversationStarterBlock('cs-id', 3);

      expect(block.config.randomize).toBe(false);
    });

    it('BLOCK_FACTORIES에 등록되어 있어야 함', () => {
      expect(BLOCK_FACTORIES).toHaveProperty(BlockType.CONVERSATION_STARTER);
    });
  });

  describe('Operating Hours Block', () => {
    it('팩토리 함수가 올바른 기본값으로 블록을 생성해야 함', () => {
      const block = createOperatingHoursBlock('oh-id', 4);

      expect(block.id).toBe('oh-id');
      expect(block.type).toBe(BlockType.OPERATING_HOURS);
      expect(block.order).toBe(4);
      expect(block.visible).toBe(true);
    });

    it('7일 전체 스케줄이 포함되어야 함', () => {
      const block = createOperatingHoursBlock('oh-id', 4);

      expect(block.config.schedule).toHaveLength(7);
    });

    it('평일(월-금)은 운영일로 설정되어야 함', () => {
      const block = createOperatingHoursBlock('oh-id', 4);
      const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];

      weekdays.forEach((day) => {
        const schedule = block.config.schedule.find((s) => s.day === day);
        expect(schedule).toBeDefined();
        expect(schedule?.closed).toBe(false);
      });
    });

    it('토요일은 단축 운영, 일요일은 휴무로 설정되어야 함', () => {
      const block = createOperatingHoursBlock('oh-id', 4);

      // 토요일: 단축 운영 (10:00 - 14:00)
      const saturday = block.config.schedule.find((s) => s.day === 'sat');
      expect(saturday).toBeDefined();
      expect(saturday?.closed).toBe(false);
      expect(saturday?.open).toBe('10:00');
      expect(saturday?.close).toBe('14:00');

      // 일요일: 휴무
      const sunday = block.config.schedule.find((s) => s.day === 'sun');
      expect(sunday).toBeDefined();
      expect(sunday?.closed).toBe(true);
    });

    it('기본 타임존이 Asia/Seoul이어야 함', () => {
      const block = createOperatingHoursBlock('oh-id', 4);

      expect(block.config.timezone).toBe('Asia/Seoul');
    });

    it('현재 상태 표시가 기본적으로 활성화되어야 함', () => {
      const block = createOperatingHoursBlock('oh-id', 4);

      expect(block.config.showCurrentStatus).toBe(true);
    });

    it('운영 시간이 HH:MM 형식이어야 함', () => {
      const block = createOperatingHoursBlock('oh-id', 4);
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

      block.config.schedule.forEach((schedule) => {
        expect(schedule.open).toMatch(timeRegex);
        expect(schedule.close).toMatch(timeRegex);
      });
    });

    it('BLOCK_FACTORIES에 등록되어 있어야 함', () => {
      expect(BLOCK_FACTORIES).toHaveProperty(BlockType.OPERATING_HOURS);
    });
  });

  describe('BLOCK_METAS', () => {
    const phase3BlockTypes = [
      BlockType.AI_CHAT_PREVIEW,
      BlockType.KNOWLEDGE_BASE_LINK,
      BlockType.FAQ_QUICK_ACTIONS,
      BlockType.CONVERSATION_STARTER,
      BlockType.OPERATING_HOURS,
    ];

    it.each(phase3BlockTypes)('%s 블록의 메타 정보가 정의되어 있어야 함', (blockType) => {
      expect(BLOCK_METAS).toHaveProperty(blockType);
      expect(BLOCK_METAS[blockType]).toHaveProperty('name');
      expect(BLOCK_METAS[blockType]).toHaveProperty('icon');
      expect(BLOCK_METAS[blockType]).toHaveProperty('description');
    });

    it.each(phase3BlockTypes)('%s 블록의 name은 문자열이어야 함', (blockType) => {
      expect(typeof BLOCK_METAS[blockType].name).toBe('string');
      expect(BLOCK_METAS[blockType].name.length).toBeGreaterThan(0);
    });
  });
});
