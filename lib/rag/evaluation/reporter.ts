/**
 * 평가 결과 리포터
 *
 * 평가 결과를 콘솔 출력 및 파일로 저장합니다.
 */

import { writeFile } from 'fs/promises';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';
import type { EvaluationReport, QuestionType } from './types';

/**
 * 콘솔에 평가 요약 출력
 */
export function printSummary(report: EvaluationReport): void {
  const { summary, executionMetadata } = report;

  console.log('\n' + '='.repeat(60));
  console.log('📊 RAG 평가 결과');
  console.log('='.repeat(60));

  console.log(`\n데이터셋: ${report.datasetName} (v${report.datasetVersion})`);
  console.log(`평가 항목: ${summary.totalItems}개`);
  console.log(`실행 시간: ${formatDuration(executionMetadata.totalDuration)}`);
  console.log(`평가 모델: ${executionMetadata.evaluationModel}`);

  console.log('\n' + '-'.repeat(60));
  console.log('📈 전체 점수');
  console.log('-'.repeat(60));

  printScoreBar('Faithfulness', summary.avgFaithfulness);
  printScoreBar('Answer Relevancy', summary.avgAnswerRelevancy);
  printScoreBar('Context Precision', summary.avgContextPrecision);
  if (summary.avgContextRecall !== undefined) {
    printScoreBar('Context Recall', summary.avgContextRecall);
  }

  // 질문 유형별 분석
  const questionTypes = Object.entries(summary.byQuestionType) as Array<
    [QuestionType, { count: number; avgFaithfulness: number; avgAnswerRelevancy: number }]
  >;

  if (questionTypes.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('📋 질문 유형별 분석');
    console.log('-'.repeat(60));

    for (const [type, stats] of questionTypes) {
      const avgScore = (stats.avgFaithfulness + stats.avgAnswerRelevancy) / 2;
      console.log(
        `  ${getQuestionTypeLabel(type)} (${stats.count}개): ` +
          `평균 ${(avgScore * 100).toFixed(1)}%`
      );
    }
  }

  // Query Rewriting 효과
  if (summary.queryRewritingImpact) {
    console.log('\n' + '-'.repeat(60));
    console.log('🔄 Query Rewriting 효과');
    console.log('-'.repeat(60));
    console.log(`  재작성된 쿼리: ${summary.queryRewritingImpact.itemsWithRewriting}개`);

    const improvement = summary.queryRewritingImpact.avgScoreImprovement;
    const sign = improvement >= 0 ? '+' : '';
    console.log(`  점수 영향: ${sign}${(improvement * 100).toFixed(1)}%`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * 점수 막대 출력
 */
function printScoreBar(label: string, score: number): void {
  const percentage = score * 100;
  const barLength = 20;
  const filledLength = Math.round(score * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  const paddedLabel = label.padEnd(18);
  const scoreStr = percentage.toFixed(1).padStart(5) + '%';

  // 점수에 따른 상태 이모지
  let status = '';
  if (percentage >= 90) status = '✅';
  else if (percentage >= 70) status = '🟡';
  else status = '🔴';

  console.log(`  ${paddedLabel} │ ${bar} │ ${scoreStr} ${status}`);
}

/**
 * 질문 유형 라벨
 */
function getQuestionTypeLabel(type: QuestionType): string {
  const labels: Record<QuestionType, string> = {
    factual: '사실 확인',
    followup: '후속 질문',
    comparison: '비교',
    procedural: '절차/방법',
    reasoning: '추론',
    unanswerable: '답변 불가',
  };
  return labels[type] || type;
}

/**
 * 시간 포맷
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}초`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}분 ${seconds}초`;
}

/**
 * JSON 파일로 저장
 */
export async function generateReportFile(report: EvaluationReport, path: string): Promise<void> {
  // 디렉토리 생성
  await mkdir(dirname(path), { recursive: true });

  // JSON 저장
  const content = JSON.stringify(report, null, 2);
  await writeFile(path, content, 'utf-8');
}

/**
 * 마크다운 리포트 생성
 */
export function generateMarkdownReport(report: EvaluationReport): string {
  const { summary, executionMetadata, results } = report;

  let md = `# RAG 평가 리포트

## 개요

| 항목 | 값 |
|------|-----|
| 데이터셋 | ${report.datasetName} (v${report.datasetVersion}) |
| 평가 일시 | ${report.evaluatedAt} |
| 평가 항목 수 | ${summary.totalItems}개 |
| 실행 시간 | ${formatDuration(executionMetadata.totalDuration)} |
| 평가 모델 | ${executionMetadata.evaluationModel} |

## 전체 점수

| 메트릭 | 점수 | 상태 |
|--------|------|------|
| Faithfulness | ${(summary.avgFaithfulness * 100).toFixed(1)}% | ${getStatusEmoji(summary.avgFaithfulness)} |
| Answer Relevancy | ${(summary.avgAnswerRelevancy * 100).toFixed(1)}% | ${getStatusEmoji(summary.avgAnswerRelevancy)} |
| Context Precision | ${(summary.avgContextPrecision * 100).toFixed(1)}% | ${getStatusEmoji(summary.avgContextPrecision)} |
`;

  if (summary.avgContextRecall !== undefined) {
    md += `| Context Recall | ${(summary.avgContextRecall * 100).toFixed(1)}% | ${getStatusEmoji(summary.avgContextRecall)} |\n`;
  }

  // 질문 유형별 분석
  const questionTypes = Object.entries(summary.byQuestionType);
  if (questionTypes.length > 0) {
    md += `\n## 질문 유형별 분석\n\n`;
    md += `| 유형 | 개수 | Faithfulness | Answer Relevancy |\n`;
    md += `|------|------|--------------|------------------|\n`;

    for (const [type, stats] of questionTypes) {
      md += `| ${getQuestionTypeLabel(type as QuestionType)} | ${stats.count} | ${(stats.avgFaithfulness * 100).toFixed(1)}% | ${(stats.avgAnswerRelevancy * 100).toFixed(1)}% |\n`;
    }
  }

  // 개선이 필요한 항목
  const lowScoreItems = results.filter(
    (r) => r.scores.faithfulness < 0.7 || r.scores.answerRelevancy < 0.7
  );

  if (lowScoreItems.length > 0) {
    md += `\n## 개선 필요 항목 (${lowScoreItems.length}개)\n\n`;

    for (const item of lowScoreItems.slice(0, 10)) {
      md += `### ${item.itemId}\n\n`;
      md += `- **질문**: ${item.question}\n`;
      md += `- **Faithfulness**: ${(item.scores.faithfulness * 100).toFixed(1)}%\n`;
      md += `- **Answer Relevancy**: ${(item.scores.answerRelevancy * 100).toFixed(1)}%\n`;

      if (item.analysis.faithfulness?.unsupportedClaims.length) {
        md += `- **근거 없는 주장**: ${item.analysis.faithfulness.unsupportedClaims.join(', ')}\n`;
      }

      md += '\n';
    }

    if (lowScoreItems.length > 10) {
      md += `\n... 외 ${lowScoreItems.length - 10}개\n`;
    }
  }

  return md;
}

/**
 * 점수에 따른 상태 이모지
 */
function getStatusEmoji(score: number): string {
  if (score >= 0.9) return '✅ 우수';
  if (score >= 0.7) return '🟡 양호';
  return '🔴 개선 필요';
}
