'use client';

/**
 * 청크 검토 필터
 * [v2] 검색 상태, 컨텍스트, 콘텐츠 길이 필터 추가
 */

import { useState } from 'react';
import Link from 'next/link';
import type { ChunkStatus, SearchabilityStatus } from '@/lib/review/types';

export interface FilterState {
  status: ChunkStatus[];
  minQualityScore?: number;
  maxQualityScore?: number;
  search: string;
  sortBy: 'qualityScore' | 'chunkIndex' | 'createdAt' | 'status' | 'contentLength';
  sortOrder: 'asc' | 'desc';
  // v2 확장 필터
  searchability: SearchabilityStatus[];
  hasContext?: boolean;
  minContentLength?: number;
  maxContentLength?: number;
  includeMetrics?: boolean;
}

interface ReviewFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const STATUS_OPTIONS: { value: ChunkStatus; label: string }[] = [
  { value: 'pending', label: '대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '거부' },
  { value: 'modified', label: '수정됨' },
];

const SEARCHABILITY_OPTIONS: { value: SearchabilityStatus; label: string; icon: string }[] = [
  { value: 'full', label: 'Hybrid', icon: 'H' },
  { value: 'partial', label: '부분', icon: 'D/S' },
  { value: 'none', label: '불가', icon: '-' },
];

const SORT_OPTIONS: { value: FilterState['sortBy']; label: string }[] = [
  { value: 'createdAt', label: '생성일' },
  { value: 'qualityScore', label: '품질 점수' },
  { value: 'chunkIndex', label: '청크 순서' },
  { value: 'status', label: '상태' },
  { value: 'contentLength', label: '콘텐츠 길이' },
];

export function ReviewFilters({ filters, onChange }: ReviewFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const handleStatusToggle = (status: ChunkStatus) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onChange({ ...filters, status: newStatus });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChange({ ...filters, search: searchInput });
  };

  const handleSortChange = (sortBy: FilterState['sortBy']) => {
    if (filters.sortBy === sortBy) {
      // 같은 정렬 기준 클릭 시 순서 토글
      onChange({
        ...filters,
        sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
      });
    } else {
      onChange({ ...filters, sortBy, sortOrder: 'desc' });
    }
  };

  const handleQualityChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    if (type === 'min') {
      onChange({ ...filters, minQualityScore: numValue });
    } else {
      onChange({ ...filters, maxQualityScore: numValue });
    }
  };

  // v2 필터 핸들러
  const handleSearchabilityToggle = (searchability: SearchabilityStatus) => {
    const newSearchability = filters.searchability.includes(searchability)
      ? filters.searchability.filter((s) => s !== searchability)
      : [...filters.searchability, searchability];
    onChange({ ...filters, searchability: newSearchability });
  };

  const handleHasContextToggle = () => {
    onChange({
      ...filters,
      hasContext: filters.hasContext === undefined ? true : filters.hasContext ? false : undefined,
    });
  };

  const handleContentLengthChange = (type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    if (type === 'min') {
      onChange({ ...filters, minContentLength: numValue });
    } else {
      onChange({ ...filters, maxContentLength: numValue });
    }
  };

  const handleMetricsToggle = () => {
    onChange({ ...filters, includeMetrics: !filters.includeMetrics });
  };

  const clearFilters = () => {
    setSearchInput('');
    onChange({
      status: [],
      minQualityScore: undefined,
      maxQualityScore: undefined,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      // v2 초기화
      searchability: [],
      hasContext: undefined,
      minContentLength: undefined,
      maxContentLength: undefined,
      includeMetrics: false,
    });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.minQualityScore !== undefined ||
    filters.maxQualityScore !== undefined ||
    filters.search !== '' ||
    // v2 필터 체크
    filters.searchability.length > 0 ||
    filters.hasContext !== undefined ||
    filters.minContentLength !== undefined ||
    filters.maxContentLength !== undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* 상태 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">상태:</span>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusToggle(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filters.status.includes(option.value)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 품질 점수 범위 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">품질:</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="최소"
            value={filters.minQualityScore ?? ''}
            onChange={(e) => handleQualityChange('min', e.target.value)}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="최대"
            value={filters.maxQualityScore ?? ''}
            onChange={(e) => handleQualityChange('max', e.target.value)}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>

        {/* v2: 검색 상태 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">검색:</span>
          <div className="flex gap-1">
            {SEARCHABILITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSearchabilityToggle(option.value)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  filters.searchability.includes(option.value)
                    ? option.value === 'full'
                      ? 'bg-green-500/20 text-green-500'
                      : option.value === 'partial'
                        ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-destructive/20 text-destructive'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title={
                  option.value === 'full'
                    ? 'Hybrid 검색 가능 (Dense + Sparse)'
                    : option.value === 'partial'
                      ? 'Dense 또는 Sparse 중 하나만 가능'
                      : '검색 불가'
                }
              >
                <span className="mr-1 font-mono">{option.icon}</span>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* v2: 컨텍스트 필터 */}
        <button
          onClick={handleHasContextToggle}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            filters.hasContext === true
              ? 'bg-purple-500/20 text-purple-500'
              : filters.hasContext === false
                ? 'bg-muted text-muted-foreground line-through'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          title={
            filters.hasContext === true
              ? 'AI 컨텍스트 있음만 표시'
              : filters.hasContext === false
                ? 'AI 컨텍스트 없음만 표시'
                : '컨텍스트 필터 없음'
          }
        >
          <SparklesIcon className="h-3 w-3" />
          컨텍스트
          {filters.hasContext !== undefined && (
            <span className="ml-0.5">{filters.hasContext ? '✓' : '✗'}</span>
          )}
        </button>

        {/* v2: 콘텐츠 길이 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">길이:</span>
          <input
            type="number"
            min="0"
            placeholder="최소"
            value={filters.minContentLength ?? ''}
            onChange={(e) => handleContentLengthChange('min', e.target.value)}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
          <span className="text-muted-foreground">-</span>
          <input
            type="number"
            min="0"
            placeholder="최대"
            value={filters.maxContentLength ?? ''}
            onChange={(e) => handleContentLengthChange('max', e.target.value)}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>

        {/* v2: 메트릭 컬럼 표시 토글 */}
        <button
          onClick={handleMetricsToggle}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            filters.includeMetrics
              ? 'bg-primary/20 text-primary'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          title="검색 상태, 크기, 버전 컬럼 표시"
        >
          <ChartIcon className="h-3 w-3" />
          상세 지표
        </button>

        {/* 검색 */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-48 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="rounded bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80"
          >
            검색
          </button>
        </form>

        {/* 정렬 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">정렬:</span>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              handleSortChange(e.target.value as FilterState['sortBy'])
            }
            className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              onChange({
                ...filters,
                sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
              })
            }
            className="rounded border border-border px-2 py-1.5 text-sm text-foreground hover:bg-muted"
            title={filters.sortOrder === 'asc' ? '오름차순' : '내림차순'}
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* 필터 초기화 */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            필터 초기화
          </button>
        )}

        {/* 순차 리뷰 모드 링크 */}
        <Link
          href="/review/sequential"
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          순차 리뷰
        </Link>
      </div>
    </div>
  );
}

// 아이콘 컴포넌트
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}
