/**
 * 청크 상세 페이지
 * Console 마이그레이션
 */

import { ChunkDetail } from './_components/chunk-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChunkDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ChunkDetail chunkId={id} />
    </div>
  );
}
