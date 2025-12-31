/**
 * RAG 평가 CLI 도구
 *
 * 평가 데이터셋을 로드하고 RAG 파이프라인 품질을 측정합니다.
 *
 * @example
 * ```bash
 * # 기본 실행
 * pnpm rag:evaluate --dataset data/evaluation/sample-dataset.json
 *
 * # 특정 메트릭만
 * pnpm rag:evaluate -d sample.json -m faithfulness,answerRelevancy
 *
 * # 결과 저장
 * pnpm rag:evaluate -d sample.json -o results/report.json
 * ```
 */

import 'dotenv/config';
import { parseArgs } from 'util';
import { loadDataset, getDatasetStats } from '../lib/rag/evaluation/dataset';
import { RagEvaluator } from '../lib/rag/evaluation/evaluator';
import { printSummary, generateReportFile, generateMarkdownReport } from '../lib/rag/evaluation/reporter';
import { writeFile } from 'fs/promises';
import type { MetricName } from '../lib/rag/evaluation/types';

const VALID_METRICS: MetricName[] = ['faithfulness', 'answerRelevancy', 'contextPrecision', 'contextRecall'];

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      dataset: { type: 'string', short: 'd' },
      output: { type: 'string', short: 'o' },
      metrics: { type: 'string', short: 'm' },
      concurrency: { type: 'string', short: 'c' },
      'max-chunks': { type: 'string' },
      markdown: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      verbose: { type: 'boolean', short: 'v' },
    },
    allowPositionals: true,
  });

  // 도움말
  if (values.help) {
    printHelp();
    process.exit(0);
  }

  // 데이터셋 경로 (--dataset 또는 첫 번째 positional argument)
  const datasetPath = values.dataset || positionals[0];
  if (!datasetPath) {
    console.error('❌ 오류: 평가 데이터셋 경로가 필요합니다.\n');
    printHelp();
    process.exit(1);
  }

  console.log('\n📊 RAG 평가 시스템\n');

  // 데이터셋 로드
  let dataset;
  try {
    console.log(`📂 데이터셋 로드: ${datasetPath}`);
    dataset = await loadDataset(datasetPath);

    const stats = getDatasetStats(dataset);
    console.log(`   이름: ${dataset.name}`);
    console.log(`   버전: ${dataset.version}`);
    console.log(`   테넌트 ID: ${dataset.tenantId}`);
    console.log(`   항목 수: ${stats.totalItems}개`);
    console.log(`   질문 유형: ${Object.entries(stats.byQuestionType).map(([k, v]) => `${k}(${v})`).join(', ')}`);

    if (stats.withConversationHistory > 0) {
      console.log(`   후속 질문: ${stats.withConversationHistory}개`);
    }

    // 테넌트 ID 경고
    if (dataset.tenantId === 'YOUR_TENANT_ID') {
      console.log('\n⚠️  경고: tenantId가 "YOUR_TENANT_ID"로 설정되어 있습니다.');
      console.log('   실제 테넌트 ID로 변경하지 않으면 검색 결과가 없어 모든 점수가 0이 됩니다.');
    }
    console.log();
  } catch (error) {
    console.error(`❌ 데이터셋 로드 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // 메트릭 파싱
  let metrics: MetricName[] | undefined;
  if (values.metrics) {
    const requestedMetrics = values.metrics.split(',').map((m) => m.trim()) as MetricName[];
    const invalidMetrics = requestedMetrics.filter((m) => !VALID_METRICS.includes(m));

    if (invalidMetrics.length > 0) {
      console.error(`❌ 잘못된 메트릭: ${invalidMetrics.join(', ')}`);
      console.error(`   사용 가능: ${VALID_METRICS.join(', ')}`);
      process.exit(1);
    }

    metrics = requestedMetrics;
    console.log(`📏 평가 메트릭: ${metrics.join(', ')}`);
  }

  // 평가 실행
  console.log('⏳ 평가 실행 중...\n');

  const startTime = Date.now();
  let lastProgress = 0;

  const evaluator = new RagEvaluator({
    metrics,
    concurrency: values.concurrency ? parseInt(values.concurrency, 10) : 3,
    maxChunks: values['max-chunks'] ? parseInt(values['max-chunks'], 10) : 5,
    onProgress: (current, total) => {
      // 진행률 표시 (10% 단위)
      const progress = Math.floor((current / total) * 10);
      if (progress > lastProgress) {
        process.stdout.write(`   진행: ${current}/${total} (${Math.round((current / total) * 100)}%)\r`);
        lastProgress = progress;
      }
    },
  });

  let report;
  try {
    report = await evaluator.evaluate(dataset);
  } catch (error) {
    console.error(`\n❌ 평가 실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  console.log(`\n✅ 평가 완료 (${Math.round(duration / 1000)}초)\n`);

  // 결과 출력
  printSummary(report);

  // JSON 저장
  if (values.output) {
    const outputPath = values.output;
    await generateReportFile(report, outputPath);
    console.log(`💾 JSON 리포트 저장: ${outputPath}`);

    // 마크다운도 저장
    if (values.markdown) {
      const mdPath = outputPath.replace(/\.json$/, '.md');
      const mdContent = generateMarkdownReport(report);
      await writeFile(mdPath, mdContent, 'utf-8');
      console.log(`📝 마크다운 리포트 저장: ${mdPath}`);
    }
  }

  // 상세 결과 (verbose 모드)
  if (values.verbose) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 상세 결과');
    console.log('='.repeat(60));

    // 검색 결과 없는 항목 카운트
    const noChunksCount = report.results.filter((r) => r.retrievedChunks.length === 0).length;
    if (noChunksCount > 0) {
      console.log(`\n⚠️  ${noChunksCount}개 항목에서 검색 결과가 없었습니다.`);
      console.log('   tenantId가 올바른지, 해당 테넌트에 문서가 업로드되어 있는지 확인하세요.\n');
    }

    for (const result of report.results) {
      console.log(`\n[${result.itemId}] ${result.question}`);
      console.log(`  유형: ${result.questionType}`);
      console.log(`  검색: ${result.retrievedChunks.length}개 청크`);
      if (result.rewrittenQuery) {
        console.log(`  재작성: ${result.rewrittenQuery}`);
      }
      console.log(`  답변: ${result.generatedAnswer.slice(0, 100)}${result.generatedAnswer.length > 100 ? '...' : ''}`);
      console.log(`  점수: F=${(result.scores.faithfulness * 100).toFixed(0)}% AR=${(result.scores.answerRelevancy * 100).toFixed(0)}% CP=${(result.scores.contextPrecision * 100).toFixed(0)}%`);
    }
  }

  console.log();
}

function printHelp(): void {
  console.log(`
RAG 평가 CLI 도구

사용법:
  pnpm rag:evaluate --dataset <path> [options]
  pnpm rag:evaluate <path> [options]

옵션:
  -d, --dataset <path>      평가 데이터셋 JSON 파일 경로 (필수)
  -o, --output <path>       결과 리포트 JSON 저장 경로
  -m, --metrics <list>      평가 메트릭 (쉼표 구분)
                            faithfulness,answerRelevancy,contextPrecision,contextRecall
  -c, --concurrency <n>     병렬 처리 개수 (기본: 3)
  --max-chunks <n>          검색 청크 수 (기본: 5)
  --markdown                마크다운 리포트도 함께 저장
  -v, --verbose             상세 결과 출력
  -h, --help                도움말 표시

예시:
  # 기본 평가 실행
  pnpm rag:evaluate -d data/evaluation/sample-dataset.json

  # 특정 메트릭만 평가
  pnpm rag:evaluate -d sample.json -m faithfulness,answerRelevancy

  # 결과 저장 (JSON + 마크다운)
  pnpm rag:evaluate -d sample.json -o results/report.json --markdown

  # 상세 결과 출력
  pnpm rag:evaluate -d sample.json -v

환경 변수:
  GOOGLE_GENERATIVE_AI_API_KEY  Gemini API 키 (필수)
  OPENAI_API_KEY                OpenAI API 키 (폴백용)
  DATABASE_URL                  데이터베이스 연결 문자열
`);
}

main().catch((error) => {
  console.error('❌ 예상치 못한 오류:', error);
  process.exit(1);
});
