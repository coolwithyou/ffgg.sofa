'use client';

/**
 * 마크다운 문법 도움말 모달
 *
 * 사용자가 마크다운 문법을 쉽게 참고할 수 있도록
 * 자주 사용하는 문법과 예제를 보여줍니다.
 */

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface SyntaxItem {
  name: string;
  syntax: string;
  example?: string;
  result?: string;
}

const syntaxGroups: { title: string; items: SyntaxItem[] }[] = [
  {
    title: '제목 (Headings)',
    items: [
      { name: '제목 1', syntax: '# 제목', result: '가장 큰 제목' },
      { name: '제목 2', syntax: '## 제목', result: '섹션 제목' },
      { name: '제목 3', syntax: '### 제목', result: '소제목' },
    ],
  },
  {
    title: '텍스트 강조',
    items: [
      { name: '굵게', syntax: '**텍스트**', result: '텍스트' },
      { name: '기울임', syntax: '*텍스트*', result: '텍스트' },
      { name: '굵은 기울임', syntax: '***텍스트***', result: '텍스트' },
      { name: '취소선', syntax: '~~텍스트~~', result: '텍스트' },
    ],
  },
  {
    title: '리스트',
    items: [
      {
        name: '순서 없는',
        syntax: '- 항목',
        example: '- 사과\n- 바나나\n- 오렌지',
      },
      {
        name: '순서 있는',
        syntax: '1. 항목',
        example: '1. 첫 번째\n2. 두 번째\n3. 세 번째',
      },
      {
        name: '중첩',
        syntax: '  - 하위 항목',
        example: '- 과일\n  - 사과\n  - 바나나',
      },
    ],
  },
  {
    title: '링크 & 이미지',
    items: [
      { name: '링크', syntax: '[텍스트](URL)', example: '[구글](https://google.com)' },
      { name: '이미지', syntax: '![설명](이미지URL)', example: '![로고](logo.png)' },
    ],
  },
  {
    title: '코드',
    items: [
      { name: '인라인 코드', syntax: '`코드`', example: '`npm install`' },
      {
        name: '코드 블록',
        syntax: '```언어\n코드\n```',
        example: '```javascript\nconst x = 1;\n```',
      },
    ],
  },
  {
    title: '기타',
    items: [
      { name: '인용구', syntax: '> 텍스트', example: '> 인용문입니다.' },
      { name: '수평선', syntax: '---', result: '가로 구분선' },
      {
        name: '테이블',
        syntax: '| A | B |',
        example: '| 이름 | 나이 |\n|------|------|\n| 홍길동 | 30 |',
      },
      { name: '체크박스', syntax: '- [ ] 할일', example: '- [x] 완료\n- [ ] 미완료' },
    ],
  },
];

export function MarkdownHelpModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="마크다운 문법 도움말">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>마크다운 문법 가이드</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-2">
          <div className="space-y-6">
            {syntaxGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-3 text-sm font-semibold text-foreground">{group.title}</h3>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.name}
                      className="grid grid-cols-[100px_1fr] gap-3 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <div className="text-sm font-medium text-muted-foreground">{item.name}</div>
                      <div className="space-y-1">
                        <code className="block rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
                          {item.syntax}
                        </code>
                        {item.example && (
                          <pre className="mt-1 whitespace-pre-wrap rounded bg-card px-2 py-1 font-mono text-xs text-muted-foreground">
                            {item.example}
                          </pre>
                        )}
                        {item.result && (
                          <span className="text-xs text-muted-foreground">→ {item.result}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 팁 섹션 */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">유용한 팁</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>
                  • <code className="rounded bg-muted px-1">#</code> 뒤에 반드시 공백을 넣으세요
                </li>
                <li>• 줄바꿈: 문장 끝에 스페이스 2개 또는 빈 줄 추가</li>
                <li>
                  • 특수문자 그대로 표시: <code className="rounded bg-muted px-1">\*</code>,{' '}
                  <code className="rounded bg-muted px-1">\#</code>
                </li>
                <li>• 코드 블록에 언어명을 넣으면 구문 강조가 적용됩니다</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
