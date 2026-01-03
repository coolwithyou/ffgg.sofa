/**
 * Phase 3 블록 스키마 검증 테스트
 *
 * Zod 스키마를 사용한 Phase 3 블록들의 유효성 검증을 테스트합니다:
 * - 올바른 데이터 검증 통과
 * - 잘못된 데이터 검증 실패
 * - 엣지 케이스 처리
 */

import { describe, it, expect } from 'vitest';
import {
  aiChatPreviewBlockSchema,
  knowledgeBaseLinkBlockSchema,
  faqQuickActionsBlockSchema,
  conversationStarterBlockSchema,
  operatingHoursBlockSchema,
  blockSchema,
} from '@/lib/public-page/block-schema';
import { BlockType } from '@/lib/public-page/block-types';

describe('Phase 3 블록 스키마 검증', () => {
  describe('AI Chat Preview Block Schema', () => {
    const validBlock = {
      id: 'test-id',
      type: BlockType.AI_CHAT_PREVIEW,
      order: 0,
      visible: true,
      config: {
        conversations: [
          { role: 'user' as const, content: '안녕하세요' },
          { role: 'assistant' as const, content: '반갑습니다!' },
        ],
        showTypingAnimation: true,
      },
    };

    it('올바른 블록 데이터를 검증 통과해야 함', () => {
      const result = aiChatPreviewBlockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });

    it('빈 대화 목록도 허용해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, conversations: [] },
      };
      const result = aiChatPreviewBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('잘못된 role은 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: {
          ...validBlock.config,
          conversations: [{ role: 'invalid', content: 'test' }],
        },
      };
      const result = aiChatPreviewBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('content가 누락되면 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: {
          ...validBlock.config,
          conversations: [{ role: 'user' }],
        },
      };
      const result = aiChatPreviewBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('blockSchema의 discriminated union에서 파싱되어야 함', () => {
      const result = blockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe(BlockType.AI_CHAT_PREVIEW);
      }
    });
  });

  describe('Knowledge Base Link Block Schema', () => {
    const validBlock = {
      id: 'kb-id',
      type: BlockType.KNOWLEDGE_BASE_LINK,
      order: 1,
      visible: true,
      config: {
        documentId: 'doc-123',
        showPreview: true,
      },
    };

    it('올바른 블록 데이터를 검증 통과해야 함', () => {
      const result = knowledgeBaseLinkBlockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });

    it('title 필드는 선택적이어야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, title: '문서 제목' },
      };
      const result = knowledgeBaseLinkBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('documentId가 누락되면 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: { showPreview: true },
      };
      const result = knowledgeBaseLinkBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('blockSchema의 discriminated union에서 파싱되어야 함', () => {
      const result = blockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });
  });

  describe('FAQ Quick Actions Block Schema', () => {
    const validBlock = {
      id: 'faq-id',
      type: BlockType.FAQ_QUICK_ACTIONS,
      order: 2,
      visible: true,
      config: {
        questions: [
          { text: '결제 방법은?' },
          { text: '배송은 얼마나 걸리나요?' },
        ],
        layout: 'buttons' as const,
      },
    };

    it('올바른 블록 데이터를 검증 통과해야 함', () => {
      const result = faqQuickActionsBlockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });

    it('다양한 레이아웃 값을 허용해야 함', () => {
      const layouts = ['buttons', 'chips', 'list'] as const;

      layouts.forEach((layout) => {
        const block = {
          ...validBlock,
          config: { ...validBlock.config, layout },
        };
        const result = faqQuickActionsBlockSchema.safeParse(block);
        expect(result.success).toBe(true);
      });
    });

    it('잘못된 레이아웃 값은 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, layout: 'invalid' },
      };
      const result = faqQuickActionsBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('빈 질문 목록도 허용해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, questions: [] },
      };
      const result = faqQuickActionsBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('질문에 text 필드가 없으면 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, questions: [{}] },
      };
      const result = faqQuickActionsBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('blockSchema의 discriminated union에서 파싱되어야 함', () => {
      const result = blockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });
  });

  describe('Conversation Starter Block Schema', () => {
    const validBlock = {
      id: 'cs-id',
      type: BlockType.CONVERSATION_STARTER,
      order: 3,
      visible: true,
      config: {
        prompts: ['안녕하세요', '도움이 필요해요'],
        style: 'card' as const,
        randomize: false,
      },
    };

    it('올바른 블록 데이터를 검증 통과해야 함', () => {
      const result = conversationStarterBlockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });

    it('다양한 스타일 값을 허용해야 함', () => {
      const styles = ['card', 'bubble', 'minimal'] as const;

      styles.forEach((style) => {
        const block = {
          ...validBlock,
          config: { ...validBlock.config, style },
        };
        const result = conversationStarterBlockSchema.safeParse(block);
        expect(result.success).toBe(true);
      });
    });

    it('잘못된 스타일 값은 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, style: 'invalid' },
      };
      const result = conversationStarterBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('빈 프롬프트 목록도 허용해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, prompts: [] },
      };
      const result = conversationStarterBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('프롬프트가 문자열이 아니면 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, prompts: [123] },
      };
      const result = conversationStarterBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('blockSchema의 discriminated union에서 파싱되어야 함', () => {
      const result = blockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });
  });

  describe('Operating Hours Block Schema', () => {
    const validBlock = {
      id: 'oh-id',
      type: BlockType.OPERATING_HOURS,
      order: 4,
      visible: true,
      config: {
        schedule: [
          { day: 'mon' as const, open: '09:00', close: '18:00', closed: false },
          { day: 'tue' as const, open: '09:00', close: '18:00', closed: false },
        ],
        timezone: 'Asia/Seoul',
        showCurrentStatus: true,
      },
    };

    it('올바른 블록 데이터를 검증 통과해야 함', () => {
      const result = operatingHoursBlockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });

    it('모든 요일 값을 허용해야 함', () => {
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

      days.forEach((day) => {
        const block = {
          ...validBlock,
          config: {
            ...validBlock.config,
            schedule: [{ day, open: '09:00', close: '18:00', closed: false }],
          },
        };
        const result = operatingHoursBlockSchema.safeParse(block);
        expect(result.success).toBe(true);
      });
    });

    it('잘못된 요일 값은 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: {
          ...validBlock.config,
          schedule: [{ day: 'invalid', open: '09:00', close: '18:00', closed: false }],
        },
      };
      const result = operatingHoursBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('올바른 시간 형식을 허용해야 함 (HH:MM)', () => {
      const validTimes = ['00:00', '09:00', '12:30', '18:45', '23:59'];

      validTimes.forEach((time) => {
        const block = {
          ...validBlock,
          config: {
            ...validBlock.config,
            schedule: [{ day: 'mon' as const, open: time, close: time, closed: false }],
          },
        };
        const result = operatingHoursBlockSchema.safeParse(block);
        expect(result.success).toBe(true);
      });
    });

    it('잘못된 시간 형식은 거부해야 함', () => {
      const invalidTimes = ['9:00', '25:00', '12:60', '1200', '12-00'];

      invalidTimes.forEach((time) => {
        const block = {
          ...validBlock,
          config: {
            ...validBlock.config,
            schedule: [{ day: 'mon' as const, open: time, close: '18:00', closed: false }],
          },
        };
        const result = operatingHoursBlockSchema.safeParse(block);
        expect(result.success).toBe(false);
      });
    });

    it('빈 스케줄 목록도 허용해야 함', () => {
      const block = {
        ...validBlock,
        config: { ...validBlock.config, schedule: [] },
      };
      const result = operatingHoursBlockSchema.safeParse(block);
      expect(result.success).toBe(true);
    });

    it('timezone이 누락되면 거부해야 함', () => {
      const block = {
        ...validBlock,
        config: {
          schedule: validBlock.config.schedule,
          showCurrentStatus: true,
        },
      };
      const result = operatingHoursBlockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('blockSchema의 discriminated union에서 파싱되어야 함', () => {
      const result = blockSchema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });
  });

  describe('blockSchema Discriminated Union', () => {
    it('잘못된 type은 거부해야 함', () => {
      const block = {
        id: 'test-id',
        type: 'invalid_type',
        order: 0,
        visible: true,
        config: {},
      };
      const result = blockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('id가 누락되면 거부해야 함', () => {
      const block = {
        type: BlockType.AI_CHAT_PREVIEW,
        order: 0,
        visible: true,
        config: {
          conversations: [],
          showTypingAnimation: true,
        },
      };
      const result = blockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });

    it('order가 음수이면 거부해야 함', () => {
      const block = {
        id: 'test-id',
        type: BlockType.AI_CHAT_PREVIEW,
        order: -1,
        visible: true,
        config: {
          conversations: [],
          showTypingAnimation: true,
        },
      };
      const result = blockSchema.safeParse(block);
      expect(result.success).toBe(false);
    });
  });
});
