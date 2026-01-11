'use client';

/**
 * 문서 가져오기 다이얼로그
 *
 * 문서를 업로드하면 LLM이 분석하여 Knowledge Pages로 자동 변환합니다.
 * RAG 청킹 파이프라인을 거치지 않고 바로 페이지로 변환됩니다.
 */

import { useState, useRef } from 'react';
import { FileUp, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  uploadAndConvertDocument,
  type KnowledgePageTreeNode,
} from './actions';

// 지원되는 파일 타입
const SUPPORTED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/markdown': '.md',
};

const ACCEPT_STRING = Object.values(SUPPORTED_TYPES).join(',');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ImportDocumentDialogProps {
  chatbotId: string;
  pages: KnowledgePageTreeNode[];
  onImportStarted?: () => void;
  trigger?: React.ReactNode;
}

export function ImportDocumentDialog({
  chatbotId,
  pages,
  onImportStarted,
  trigger,
}: ImportDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 파일 크기 검증
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error(`파일 크기는 10MB 이하여야 합니다.`);
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (droppedFile.size > MAX_FILE_SIZE) {
      toast.error(`파일 크기는 10MB 이하여야 합니다.`);
      return;
    }

    setFile(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatbotId', chatbotId);
      if (selectedParentId) {
        formData.append('parentPageId', selectedParentId);
      }

      const result = await uploadAndConvertDocument(formData);

      if (result.success) {
        toast.success(
          '문서를 업로드했습니다. 백그라운드에서 페이지로 변환 중입니다.',
          { duration: 5000 }
        );
        setOpen(false);
        resetForm();
        onImportStarted?.();
      } else {
        toast.error(result.error || '업로드에 실패했습니다.');
      }
    } catch {
      toast.error('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setSelectedParentId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const flattenPages = (
    nodes: KnowledgePageTreeNode[],
    depth = 0
  ): { id: string; title: string; depth: number }[] => {
    const result: { id: string; title: string; depth: number }[] = [];
    for (const node of nodes) {
      result.push({ id: node.id, title: node.title, depth });
      result.push(...flattenPages(node.children, depth + 1));
    }
    return result;
  };

  const flatPages = flattenPages(pages);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return <FileText className="h-8 w-8 text-primary" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileUp className="mr-1 h-4 w-4" />
            문서에서 생성
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>문서에서 페이지 생성</DialogTitle>
          <DialogDescription>
            문서를 업로드하면 AI가 분석하여 자동으로 페이지를 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 파일 업로드 영역 */}
          <div className="grid gap-2">
            <Label>문서 파일</Label>
            {!file ? (
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  클릭하거나 파일을 드래그하세요
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX, XLSX, PPTX, TXT, MD (최대 10MB)
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                {getFileIcon(file.name)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={removeFile}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_STRING}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 상위 페이지 선택 (선택) */}
          <div className="grid gap-2">
            <Label htmlFor="parent">상위 페이지 (선택)</Label>
            <select
              id="parent"
              value={selectedParentId ?? ''}
              onChange={(e) => setSelectedParentId(e.target.value || null)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={isUploading}
            >
              <option value="">루트 (최상위)</option>
              {flatPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {'  '.repeat(page.depth)}
                  {page.depth > 0 ? '└ ' : ''}
                  {page.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              생성된 페이지가 이 페이지의 하위로 추가됩니다
            </p>
          </div>

          {/* 안내 메시지 */}
          <div className="rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">💡 변환 안내</p>
            <ul className="mt-1 space-y-1 text-xs">
              <li>• 문서 내용을 AI가 분석하여 적절한 페이지로 분할합니다</li>
              <li>• 변환된 페이지는 "초안" 상태로 생성됩니다</li>
              <li>• 변환 후 내용을 검토하고 발행해주세요</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            취소
          </Button>
          <Button onClick={handleImport} disabled={isUploading || !file}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                업로드 중...
              </>
            ) : (
              '변환 시작'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
