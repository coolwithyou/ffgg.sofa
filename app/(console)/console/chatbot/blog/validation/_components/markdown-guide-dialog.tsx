'use client';

/**
 * 마크다운 헤딩 가이드 다이얼로그
 *
 * 마크다운 헤딩이 페이지 계층 구조로 어떻게 변환되는지 설명합니다.
 */

import { useState } from 'react';
import { HelpCircle, FileText, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MarkdownGuideDialogProps {
  /** 트리거 버튼 커스터마이징 */
  trigger?: React.ReactNode;
}

export function MarkdownGuideDialog({ trigger }: MarkdownGuideDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">가이드</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            마크다운 헤딩과 페이지 구조 가이드
          </DialogTitle>
          <DialogDescription>
            마크다운 헤딩(#)을 사용하여 블로그 페이지의 계층 구조를 정의하는 방법을 안내합니다.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {/* 기본 원리 */}
            <section>
              <h4 className="mb-2 font-semibold text-foreground">
                페이지 구조 생성 원리
              </h4>
              <p className="text-sm text-muted-foreground">
                마크다운의 <strong className="text-foreground">헤딩(#)</strong>이
                블로그 페이지의 계층 구조를 결정합니다. 각 헤딩은 하나의 페이지가
                되며, 하위 레벨 헤딩은 상위 페이지의 자식 페이지가 됩니다.
              </p>
            </section>

            {/* 헤딩 문법 */}
            <section>
              <h4 className="mb-2 font-semibold text-foreground">
                마크다운 헤딩 문법
              </h4>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-primary">
                    # 제목
                  </code>
                  <span className="text-muted-foreground">→ H1 (최상위 페이지)</span>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-blue-500">
                    ## 제목
                  </code>
                  <span className="text-muted-foreground">→ H2 (2단계 페이지)</span>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-green-500">
                    ### 제목
                  </code>
                  <span className="text-muted-foreground">→ H3 (3단계 페이지)</span>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
                  <code className="rounded bg-muted px-2 py-0.5 text-yellow-500">
                    #### 제목
                  </code>
                  <span className="text-muted-foreground">→ H4 이하 (깊은 페이지)</span>
                </div>
              </div>
            </section>

            {/* 예시 */}
            <section>
              <h4 className="mb-2 font-semibold text-foreground">예시</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {/* 마크다운 */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    마크다운 입력
                  </div>
                  <pre className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
{`# 회사 소개
회사 개요 내용...

## 연혁
연혁 내용...

### 2024년
2024년 내용...

### 2023년
2023년 내용...

## 조직도
조직 구조 내용...`}
                  </pre>
                </div>
                {/* 결과 구조 */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    생성되는 페이지 구조
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground">회사 소개</span>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-foreground">연혁</span>
                    </div>
                    <div className="ml-8 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-foreground">2024년</span>
                    </div>
                    <div className="ml-8 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-foreground">2023년</span>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-foreground">조직도</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 범례 */}
            <section>
              <h4 className="mb-2 font-semibold text-foreground">레벨별 색상</h4>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-primary" />
                  H1 (최상위)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-blue-500" />
                  H2
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                  H3
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-yellow-500" />
                  H4+
                </span>
              </div>
            </section>

            {/* 팁 */}
            <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h4 className="mb-2 text-sm font-semibold text-primary">
                작성 팁
              </h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>
                  • H1(#)은 문서당 <strong className="text-foreground">하나만</strong>{' '}
                  사용하는 것이 좋습니다
                </li>
                <li>
                  • 헤딩 레벨을 <strong className="text-foreground">건너뛰지 마세요</strong>{' '}
                  (H1 → H3 ❌, H1 → H2 → H3 ✓)
                </li>
                <li>
                  • 각 섹션의 내용은 해당 헤딩 바로 아래에 작성합니다
                </li>
                <li>
                  • 빈 헤딩(내용 없는)은 페이지 생성 시 제외될 수 있습니다
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
