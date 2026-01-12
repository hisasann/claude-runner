import type { ProcessResult, Report } from '../types/index.js';
import { getLogger } from './logger.js';

const logger = getLogger();

export class Statistics {
  private results: ProcessResult[] = [];
  private startTime: number = Date.now();

  /**
   * 成功を記録
   */
  recordSuccess(issueNumber: number, duration: number, prUrl?: string): void {
    this.results.push({
      success: true,
      issueNumber,
      duration,
      prUrl,
    });

    logger.info(`Statistics: Recorded success for issue #${issueNumber}`);
  }

  /**
   * 失敗を記録
   */
  recordFailure(
    issueNumber: number,
    errorType: string,
    duration: number,
    errorMessage?: string
  ): void {
    this.results.push({
      success: false,
      issueNumber,
      duration,
      error: errorMessage,
      errorType: errorType as any,
    });

    logger.info(`Statistics: Recorded failure for issue #${issueNumber} (${errorType})`);
  }

  /**
   * レポートを生成
   */
  generateReport(): Report {
    const totalTime = Date.now() - this.startTime;
    const successful = this.results.filter((r) => r.success);
    const failed = this.results.filter((r) => !r.success);

    const report: Report = {
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: this.results.length > 0 ? (successful.length / this.results.length) * 100 : 0,
      averageTime:
        successful.length > 0
          ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
          : 0,
      totalTime,
      results: this.results,
    };

    logger.info('Statistics: Report generated', {
      total: report.total,
      successful: report.successful,
      failed: report.failed,
      successRate: report.successRate.toFixed(1) + '%',
    });

    return report;
  }

  /**
   * レポートをコンソールに出力
   */
  printReport(report: Report): void {
    console.log('\n' + '='.repeat(60));
    console.log('Execution Summary');
    console.log('='.repeat(60));
    console.log(`Total time: ${this.formatDuration(report.totalTime)}`);
    console.log(`Processed: ${report.total} issues`);
    console.log(`Success: ${report.successful} (${report.successRate.toFixed(1)}%)`);
    console.log(`Failed: ${report.failed}`);

    if (report.successful > 0) {
      console.log(`Average time per issue: ${this.formatDuration(report.averageTime)}`);
    }

    if (report.failed > 0) {
      console.log('\nFailed Issues:');
      report.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  #${r.issueNumber}: ${r.errorType} - ${r.error || 'Unknown error'}`);
        });
    }

    if (report.successful > 0) {
      console.log('\nSuccessful Issues:');
      report.results
        .filter((r) => r.success)
        .forEach((r) => {
          console.log(`  #${r.issueNumber}: ${r.prUrl || 'Completed'}`);
        });
    }

    console.log('='.repeat(60) + '\n');
  }

  /**
   * ミリ秒を読みやすい形式にフォーマット
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
