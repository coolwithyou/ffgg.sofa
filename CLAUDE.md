# SOFA 프로젝트 개발 지침

## 프로젝트 개요
SOFA(Smart Operator's FAQ Assistant)는 RAG 기반 챗봇 플랫폼입니다.

## 기술 스택
- **프레임워크**: Next.js 15 (App Router)
- **스타일링**: Tailwind CSS v4 + OKLCH 컬러 시스템
- **테마**: next-themes (다크/라이트 모드)
- **데이터베이스**: PostgreSQL + Prisma

---

## 다크모드 개발 가이드라인

### 테마 시스템 개요
SOFA는 다크모드를 기본으로 하며, 라이트모드도 지원합니다. 모든 컴포넌트는 반드시 두 테마 모두에서 정상 작동해야 합니다.

### 시맨틱 컬러 토큰 (필수 사용)

#### 배경 및 카드
| 토큰 | 용도 |
|------|------|
| `bg-background` | 페이지 기본 배경 |
| `bg-card` | 카드, 모달, 드롭다운 배경 |
| `bg-muted` | 비활성/뮤트 배경, 테이블 헤더 |
| `bg-muted/50` | 반투명 뮤트 배경 |

#### 텍스트
| 토큰 | 용도 |
|------|------|
| `text-foreground` | 기본 텍스트 (제목, 본문) |
| `text-muted-foreground` | 보조 텍스트 (설명, 라벨) |

#### 테두리
| 토큰 | 용도 |
|------|------|
| `border-border` | 기본 테두리 |

#### 프라이머리 (브랜드 컬러)
| 토큰 | 용도 |
|------|------|
| `bg-primary` | 주요 버튼 배경 |
| `text-primary` | 강조 텍스트, 링크 |
| `text-primary-foreground` | 주요 버튼 텍스트 |
| `bg-primary/10` | 반투명 프라이머리 배경 (배지, 선택 상태) |

#### 상태 컬러
| 토큰 | 용도 |
|------|------|
| `bg-destructive` / `text-destructive` | 오류, 거부, 삭제 |
| `bg-destructive/10` | 반투명 오류 배경 |
| `bg-green-500` / `text-green-500` | 성공, 승인 |
| `bg-green-500/10` | 반투명 성공 배경 |
| `bg-yellow-500/10 text-yellow-500` | 경고, 대기 |
| `bg-purple-500/10 text-purple-500` | AI 관련, 특수 기능 |

### 사용 금지 패턴

다음 하드코딩된 색상은 **절대 사용하지 마세요**:

```tsx
// 금지
className="bg-white"           // -> bg-card 또는 bg-background
className="bg-gray-50"         // -> bg-muted
className="text-gray-900"      // -> text-foreground
className="text-gray-600"      // -> text-muted-foreground
className="border-gray-200"    // -> border-border
className="bg-blue-600"        // -> bg-primary
className="text-blue-600"      // -> text-primary
className="bg-red-600"         // -> bg-destructive
className="text-red-600"       // -> text-destructive
```

### 권장 컴포넌트 패턴

#### 카드
```tsx
<div className="rounded-lg border border-border bg-card p-6">
  <h2 className="text-lg font-semibold text-foreground">제목</h2>
  <p className="text-muted-foreground">설명</p>
</div>
```

#### 버튼
```tsx
// 프라이머리 버튼
<button className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
  확인
</button>

// 세컨더리 버튼
<button className="rounded-md border border-border px-4 py-2 text-foreground hover:bg-muted">
  취소
</button>

// 위험 버튼
<button className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground hover:bg-destructive/90">
  삭제
</button>
```

#### 상태 배지
```tsx
const statusConfig = {
  pending: 'bg-muted text-muted-foreground',
  approved: 'bg-green-500/10 text-green-500',
  rejected: 'bg-destructive/10 text-destructive',
  processing: 'bg-primary/10 text-primary',
};
```

#### 입력 필드
```tsx
<input
  className="rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
/>
```

#### 테이블
```tsx
<table className="min-w-full divide-y divide-border">
  <thead className="bg-muted">
    <tr>
      <th className="text-muted-foreground">컬럼</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-border bg-card">
    <tr className="hover:bg-muted">
      <td className="text-foreground">값</td>
    </tr>
  </tbody>
</table>
```

#### 로딩 스피너
```tsx
<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
```

### 체크리스트

새 컴포넌트 개발 시 확인 사항:
- [ ] `bg-white`, `bg-gray-*` 대신 `bg-card`, `bg-muted` 사용
- [ ] `text-gray-*` 대신 `text-foreground`, `text-muted-foreground` 사용
- [ ] `border-gray-*` 대신 `border-border` 사용
- [ ] 상태 색상에 opacity 사용 (예: `bg-green-500/10`)
- [ ] 다크모드에서 시각적 확인 완료

---

## 기타 개발 지침

### 커밋 컨벤션
- `feat:` 새로운 기능
- `fix:` 버그 수정
- `refactor:` 리팩토링
- `style:` UI/스타일 변경
- `docs:` 문서 수정
- `chore:` 빌드/설정 변경

### 코드 스타일
- TypeScript 엄격 모드 사용
- ESLint + Prettier 규칙 준수
- 컴포넌트는 함수형으로 작성
- 서버 컴포넌트 우선, 필요시에만 'use client' 사용
