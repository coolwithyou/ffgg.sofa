'use client';

/**
 * 청크 검토 필터
 */

import { useState } from 'react';
import Link from 'next/link';
import type { ChunkStatus } from '@/lib/review/types';

export interface FilterState {
  status: ChunkStatus[];
  minQualityScore?: number;
  maxQualityScore?: number;
  search: string;
  sortBy: 'qualityScore' | 'chunkIndex' | 'createdAt' | 'status';
  sortOrder: 'asc' | 'desc';
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

const SORT_OPTIONS: { value: FilterState['sortBy']; label: string }[] = [
  { value: 'createdAt', label: '생성일' },
  { value: 'qualityScore', label: '품질 점수' },
  { value: 'chunkIndex', label: '청크 순서' },
  { value: 'status', label: '상태' },
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

  const clearFilters = () => {
    setSearchInput('');
    onChange({
      status: [],
      minQualityScore: undefined,
      maxQualityScore: undefined,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.minQualityScore !== undefined ||
    filters.maxQualityScore !== undefined ||
    filters.search !== '';

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* 상태 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">상태:</span>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusToggle(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filters.status.includes(option.value)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 품질 점수 범위 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">품질:</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="최소"
            value={filters.minQualityScore ?? ''}
            onChange={(e) => handleQualityChange('min', e.target.value)}
            className="w-16 rounded border px-2 py-1 text-sm"
          />
          <span className="text-gray-400">-</span>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="최대"
            value={filters.maxQualityScore ?? ''}
            onChange={(e) => handleQualityChange('max', e.target.value)}
            className="w-16 rounded border px-2 py-1 text-sm"
          />
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-48 rounded border px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            검색
          </button>
        </form>

        {/* 정렬 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">정렬:</span>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              handleSortChange(e.target.value as FilterState['sortBy'])
            }
            className="rounded border px-2 py-1.5 text-sm"
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
            className="rounded border px-2 py-1.5 text-sm hover:bg-gray-50"
            title={filters.sortOrder === 'asc' ? '오름차순' : '내림차순'}
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* 필터 초기화 */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            필터 초기화
          </button>
        )}

        {/* 순차 리뷰 모드 링크 */}
        <Link
          href="/review/sequential"
          className="ml-auto rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          순차 리뷰
        </Link>
      </div>
    </div>
  );
}
