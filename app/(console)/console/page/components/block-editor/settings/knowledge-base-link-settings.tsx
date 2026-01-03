'use client';

/**
 * 지식 베이스 링크 블록 설정 컴포넌트
 *
 * KnowledgeBaseLinkBlock의 설정을 편집합니다:
 * - 문서 선택 (documentId)
 * - 표시 제목
 * - 미리보기 옵션
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { KnowledgeBaseLinkBlock } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

export function KnowledgeBaseLinkBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<KnowledgeBaseLinkBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<KnowledgeBaseLinkBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<KnowledgeBaseLinkBlock>);
  };

  return (
    <div className="space-y-6">
      {/* 문서 ID */}
      <div className="space-y-2">
        <Label htmlFor="document-id">문서 ID</Label>
        <Input
          id="document-id"
          placeholder="지식 베이스 문서 ID"
          value={config.documentId}
          onChange={(e) => updateConfig({ documentId: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          연결할 지식 베이스 문서의 ID를 입력하세요.
        </p>
      </div>

      {/* 표시 제목 */}
      <div className="space-y-2">
        <Label htmlFor="display-title">표시 제목</Label>
        <Input
          id="display-title"
          placeholder="문서 제목 (선택)"
          value={config.title ?? ''}
          onChange={(e) =>
            updateConfig({ title: e.target.value || undefined })
          }
        />
        <p className="text-xs text-muted-foreground">
          비어있으면 문서 원본 제목을 사용합니다.
        </p>
      </div>

      {/* 미리보기 표시 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="show-preview" className="cursor-pointer">
            미리보기 표시
          </Label>
          <p className="text-xs text-muted-foreground">
            문서 내용 미리보기를 표시합니다.
          </p>
        </div>
        <Switch
          id="show-preview"
          checked={config.showPreview}
          onCheckedChange={(checked) => updateConfig({ showPreview: checked })}
        />
      </div>
    </div>
  );
}
