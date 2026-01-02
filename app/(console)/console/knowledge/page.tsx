'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Search } from 'lucide-react';

/**
 * Knowledge - 문서 관리 페이지
 *
 * RAG 기반 챗봇의 지식 베이스를 관리하는 페이지
 */
export default function KnowledgePage() {
  return (
    <div className="p-6">
      {/* 페이지 헤더 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            문서 관리
          </h1>
          <p className="mt-1 text-muted-foreground">
            챗봇이 학습할 문서를 업로드하고 관리하세요
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          문서 업로드
        </Button>
      </div>

      {/* 검색 바 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="문서 검색..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* 빈 상태 */}
      <Card size="lg" variant="muted">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-muted p-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="mb-2 text-lg">
            아직 업로드된 문서가 없습니다
          </CardTitle>
          <CardDescription className="mb-4 text-center">
            PDF, TXT, DOCX 파일을 업로드하여
            <br />
            챗봇의 지식 베이스를 구축하세요
          </CardDescription>
          <Button variant="outline" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            첫 문서 업로드
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
