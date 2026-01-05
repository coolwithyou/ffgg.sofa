'use client';

import { Bot, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateChatbotDialog } from '../hooks/use-console-state';

interface NoChatbotStateProps {
  title?: string;
  description?: string;
}

/**
 * NoChatbotState - 챗봇 없음 상태 컴포넌트
 *
 * 콘솔의 각 페이지에서 챗봇이 없을 때 표시하는 빈 상태 UI
 * "새 챗봇 만들기" 버튼으로 생성 다이얼로그에 바로 접근 가능
 */
export function NoChatbotState({
  title = '등록된 챗봇이 없습니다',
  description = '새 챗봇을 생성하여 시작하세요',
}: NoChatbotStateProps) {
  const { open } = useCreateChatbotDialog();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Bot className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="max-w-sm text-center">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button onClick={open} className="mt-2">
        <Plus className="mr-2 h-4 w-4" />
        새 챗봇 만들기
      </Button>
    </div>
  );
}
