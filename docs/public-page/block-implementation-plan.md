# SOFA 블록 에디터 - Phase별 구현 계획

> 작성일: 2026-01-03
> 목적: `/console/appearance` 블록 에디터의 단계별 구현 로드맵

---

## 현재 상태 분석

### 구현 완료 (3개)
| 블록 | 타입 | 위치 |
|------|------|------|
| Header | `header` | `lib/public-page/block-types.ts` |
| Chatbot | `chatbot` | `lib/public-page/block-types.ts` |
| Placeholder | `placeholder` | `lib/public-page/block-types.ts` |

### 기존 아키텍처
- **타입 시스템**: `BlockType` const + discriminated union
- **메타데이터**: `BLOCK_METAS` Record (name, description, category, icon, maxInstances)
- **팩토리 패턴**: `BLOCK_FACTORIES` Record + `createBlock()` 유틸리티
- **검증**: Zod discriminatedUnion (`lib/public-page/block-schema.ts`)
- **렌더링**: switch/case 패턴 (`app/[slug]/components/block-renderer.tsx`)
- **에디터**: @dnd-kit 기반 (`app/(console)/console/appearance/components/block-editor/`)
- **상태관리**: `useBlocks` 훅 (addBlock, removeBlock, updateBlock, reorderBlocks)

---

## Phase 0: 공통 인프라 (2-3일)

### 목표
블록별 설정 패널 시스템 구축

### 작업 항목

#### 0.1 블록 설정 패널 컨테이너
```
파일: app/(console)/console/appearance/components/block-editor/block-settings-panel.tsx
```
- 선택된 블록의 설정 UI 표시
- 블록 타입별 설정 컴포넌트 동적 로딩
- 실시간 미리보기 연동

#### 0.2 설정 컴포넌트 레지스트리
```
파일: app/(console)/console/appearance/components/block-editor/settings/index.ts
```
- `BLOCK_SETTINGS_COMPONENTS: Record<BlockTypeValue, React.ComponentType>`
- 동적 import로 코드 스플리팅

#### 0.3 기존 블록 설정 UI 구현
```
파일: app/(console)/console/appearance/components/block-editor/settings/header-settings.tsx
파일: app/(console)/console/appearance/components/block-editor/settings/chatbot-settings.tsx
```

### 검증 기준
- [ ] 블록 선택 시 우측 패널에 설정 UI 표시
- [ ] 설정 변경 시 실시간 미리보기 반영
- [ ] 설정 변경 시 저장 상태 표시 (isDirty)

---

## Phase 1: MVP P1 블록 (2-3일)

### 목표
Link in Bio 핵심 기능 완성

### 1.1 Link 블록
```typescript
interface LinkBlock extends BaseBlock {
  type: 'link';
  config: {
    url: string;
    title: string;
    description?: string;
    thumbnail?: string;
    style: 'default' | 'featured' | 'outline';
    openInNewTab: boolean;
  };
}
```

**구현 파일**:
- `lib/public-page/block-types.ts` - 타입 추가
- `lib/public-page/block-schema.ts` - Zod 스키마 추가
- `app/[slug]/components/blocks/link-block.tsx` - 렌더러
- `app/(console)/.../settings/link-settings.tsx` - 설정 UI

**기능**:
- URL 입력 및 유효성 검사
- 스타일 선택 (기본/강조/아웃라인)
- 썸네일 이미지 (선택)
- 새 탭 열기 옵션

### 1.2 Text 블록
```typescript
interface TextBlock extends BaseBlock {
  type: 'text';
  config: {
    content: string;
    align: 'left' | 'center' | 'right';
    size: 'sm' | 'md' | 'lg';
  };
}
```

**기능**:
- 멀티라인 텍스트 입력
- 정렬 옵션
- 크기 선택

### 1.3 Divider 블록
```typescript
interface DividerBlock extends BaseBlock {
  type: 'divider';
  config: {
    style: 'solid' | 'dashed' | 'dotted';
    spacing: 'sm' | 'md' | 'lg';
  };
}
```

**기능**:
- 구분선 스타일 선택
- 상하 여백 조절

### 1.4 Social Icons 블록
```typescript
interface SocialIconsBlock extends BaseBlock {
  type: 'social-icons';
  config: {
    icons: Array<{
      platform: 'instagram' | 'youtube' | 'twitter' | 'facebook' | 'tiktok' | 'kakao' | 'naver';
      url: string;
    }>;
    size: 'sm' | 'md' | 'lg';
    style: 'filled' | 'outline' | 'minimal';
  };
}
```

**기능**:
- 플랫폼별 아이콘 자동 표시
- 아이콘 추가/제거/순서 변경
- 스타일 및 크기 선택

### 검증 기준
- [ ] 4개 블록 모두 팔레트에서 추가 가능
- [ ] 드래그앤드롭 순서 변경 동작
- [ ] 설정 패널 연동
- [ ] 공개 페이지에서 정상 렌더링
- [ ] Zod 검증 통과

---

## Phase 2: 확장 블록 (7-9일)

### 2.1 Image 블록 (1-2일)
```typescript
interface ImageBlock extends BaseBlock {
  type: 'image';
  config: {
    src: string;
    alt: string;
    caption?: string;
    aspectRatio: '1:1' | '4:3' | '16:9' | 'auto';
    linkUrl?: string;
  };
}
```

**기능**:
- 이미지 업로드 (R2 연동)
- 비율 선택
- 캡션 (선택)
- 클릭 시 링크 이동 (선택)

### 2.2 Image Carousel 블록 (1-2일)
```typescript
interface ImageCarouselBlock extends BaseBlock {
  type: 'image-carousel';
  config: {
    images: Array<{
      src: string;
      alt: string;
      linkUrl?: string;
    }>;
    autoPlay: boolean;
    interval: number;
    showDots: boolean;
    showArrows: boolean;
  };
}
```

**의존성**: embla-carousel-react

### 2.3 Video 블록 (1일)
```typescript
interface VideoBlock extends BaseBlock {
  type: 'video';
  config: {
    provider: 'youtube' | 'vimeo';
    videoId: string;
    autoPlay: boolean;
    showControls: boolean;
  };
}
```

**기능**:
- YouTube/Vimeo URL 파싱
- 썸네일 자동 추출
- 임베드 플레이어

### 2.4 FAQ Accordion 블록 (1-2일)
```typescript
interface FaqAccordionBlock extends BaseBlock {
  type: 'faq-accordion';
  config: {
    items: Array<{
      question: string;
      answer: string;
    }>;
    allowMultiple: boolean;
    defaultOpen?: number;
  };
}
```

**의존성**: @radix-ui/react-accordion
**SOFA 특화**: 챗봇 FAQ와 연동 가능성

### 2.5 Contact Form 블록 (1-2일)
```typescript
interface ContactFormBlock extends BaseBlock {
  type: 'contact-form';
  config: {
    fields: Array<{
      type: 'text' | 'email' | 'textarea';
      label: string;
      required: boolean;
    }>;
    submitText: string;
    successMessage: string;
  };
}
```

**SOFA 특화**: 폼 제출 → 챗봇 대화로 전달 옵션

### 2.6 Map 블록 (1일)
```typescript
interface MapBlock extends BaseBlock {
  type: 'map';
  config: {
    provider: 'google' | 'kakao' | 'naver';
    address: string;
    lat?: number;
    lng?: number;
    zoom: number;
  };
}
```

**기능**:
- 주소 검색 → 좌표 변환
- 지도 임베드

### 검증 기준
- [ ] 이미지 업로드 → R2 저장 → URL 반환
- [ ] 캐러셀 터치/스와이프 동작
- [ ] YouTube/Vimeo URL 자동 파싱
- [ ] 아코디언 접기/펼치기 애니메이션
- [ ] 폼 제출 API 연동
- [ ] 지도 임베드 정상 표시

---

## Phase 3: SOFA 차별화 블록 (6-7일)

### 3.1 AI Chat Preview 블록 (2일)
```typescript
interface AiChatPreviewBlock extends BaseBlock {
  type: 'ai-chat-preview';
  config: {
    conversations: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
    showTypingAnimation: boolean;
  };
}
```

**기능**:
- 챗봇 대화 예시 미리보기
- 타이핑 애니메이션 효과
- 클릭 시 실제 챗봇으로 전환

### 3.2 Knowledge Base Link 블록 (1일)
```typescript
interface KnowledgeBaseLinkBlock extends BaseBlock {
  type: 'knowledge-base-link';
  config: {
    documentId: string;
    title?: string; // 미지정 시 문서 제목 사용
    showPreview: boolean;
  };
}
```

**기능**:
- 지식 베이스 문서 선택기
- 문서 미리보기 표시 옵션

### 3.3 FAQ Quick Actions 블록 (1-2일)
```typescript
interface FaqQuickActionsBlock extends BaseBlock {
  type: 'faq-quick-actions';
  config: {
    questions: Array<{
      text: string;
      // 클릭 시 챗봇에 해당 질문 전송
    }>;
    layout: 'buttons' | 'chips' | 'list';
  };
}
```

**기능**:
- 자주 묻는 질문 버튼
- 클릭 시 챗봇에 질문 자동 입력
- 레이아웃 선택

### 3.4 Conversation Starter 블록 (1일)
```typescript
interface ConversationStarterBlock extends BaseBlock {
  type: 'conversation-starter';
  config: {
    prompts: string[];
    randomize: boolean;
    style: 'card' | 'bubble' | 'minimal';
  };
}
```

**기능**:
- 대화 시작 프롬프트 제안
- 랜덤 표시 옵션

### 3.5 Operating Hours 블록 (1일)
```typescript
interface OperatingHoursBlock extends BaseBlock {
  type: 'operating-hours';
  config: {
    schedule: Array<{
      day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
      open: string; // "09:00"
      close: string; // "18:00"
      closed: boolean;
    }>;
    timezone: string;
    showCurrentStatus: boolean; // "현재 운영 중" 표시
  };
}
```

**기능**:
- 요일별 운영 시간 설정
- 현재 상태 자동 표시 (운영 중/종료)
- 타임존 지원

### 검증 기준
- [ ] AI Chat Preview 대화 애니메이션
- [ ] Knowledge Base Link 문서 선택기 연동
- [ ] FAQ Quick Actions → 챗봇 질문 전송
- [ ] Conversation Starter → 챗봇 입력 연동
- [ ] Operating Hours 현재 상태 실시간 계산

---

## 파일 구조 (최종)

```
lib/public-page/
├── block-types.ts          # 모든 블록 타입 정의
├── block-schema.ts         # Zod 검증 스키마
└── block-utils.ts          # 유틸리티 함수

app/[slug]/components/blocks/
├── header-block.tsx
├── chatbot-block.tsx
├── link-block.tsx
├── text-block.tsx
├── divider-block.tsx
├── social-icons-block.tsx
├── image-block.tsx
├── image-carousel-block.tsx
├── video-block.tsx
├── faq-accordion-block.tsx
├── contact-form-block.tsx
├── map-block.tsx
├── ai-chat-preview-block.tsx
├── knowledge-base-link-block.tsx
├── faq-quick-actions-block.tsx
├── conversation-starter-block.tsx
└── operating-hours-block.tsx

app/(console)/console/appearance/components/block-editor/settings/
├── index.ts                # 설정 컴포넌트 레지스트리
├── header-settings.tsx
├── chatbot-settings.tsx
├── link-settings.tsx
├── text-settings.tsx
├── divider-settings.tsx
├── social-icons-settings.tsx
├── image-settings.tsx
├── image-carousel-settings.tsx
├── video-settings.tsx
├── faq-accordion-settings.tsx
├── contact-form-settings.tsx
├── map-settings.tsx
├── ai-chat-preview-settings.tsx
├── knowledge-base-link-settings.tsx
├── faq-quick-actions-settings.tsx
├── conversation-starter-settings.tsx
└── operating-hours-settings.tsx
```

---

## 블록 추가 체크리스트 (각 블록마다)

1. [ ] `lib/public-page/block-types.ts`에 타입 추가
   - BlockType 상수 추가
   - 인터페이스 정의
   - Block 유니온에 추가
   - BLOCK_METAS 추가
   - 팩토리 함수 추가
   - BLOCK_FACTORIES에 등록

2. [ ] `lib/public-page/block-schema.ts`에 Zod 스키마 추가
   - discriminatedUnion에 케이스 추가

3. [ ] `app/[slug]/components/blocks/` 렌더러 컴포넌트
   - 공개 페이지용 렌더링 구현

4. [ ] `app/[slug]/components/block-renderer.tsx` switch 케이스 추가

5. [ ] `app/(console)/.../settings/` 설정 컴포넌트
   - 에디터용 설정 UI 구현

6. [ ] 설정 레지스트리에 등록

---

## 일정 요약

| Phase | 기간 | 블록 수 | 주요 내용 |
|-------|------|---------|----------|
| Phase 0 | 2-3일 | - | 설정 패널 인프라 |
| Phase 1 | 2-3일 | 4개 | MVP P1 (Link, Text, Divider, Social Icons) |
| Phase 2 | 7-9일 | 6개 | 확장 (Image, Carousel, Video, FAQ, Contact, Map) |
| Phase 3 | 6-7일 | 5개 | SOFA 차별화 블록 |

**총 예상 기간: 17-22일 (약 3-4주)**
**총 블록 수: 15개 (기존 3개 + 신규 12개)**

---

## 우선순위 조정 가능 항목

긴급도에 따라 Phase 조정 가능:
- Image 블록 → Phase 1로 승격 가능 (시각적 완성도)
- FAQ Accordion → Phase 1로 승격 가능 (SOFA 연계)
- Map 블록 → Phase 3로 이동 가능 (우선순위 낮음)

---

## 관련 문서

- [Link in Bio 서비스 분석](../research/link-in-bio-services.md)
- [Public Page 개요](./README.md)
- [새로운 방향 정리본](../visions/새로운-방향-정리본.md)

---

*이 문서는 SOFA 블록 에디터 구현의 마스터 플랜입니다.*
