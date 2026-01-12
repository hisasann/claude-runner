import type { Issue } from '../types/github.js';
import { getLogger } from './logger.js';

const logger = getLogger();

/**
 * エラーの種類
 */
export type ErrorType =
  | 'git_error'
  | 'github_api_error'
  | 'claude_api_error'
  | 'network_error'
  | 'validation_error'
  | 'timeout_error'
  | 'unknown_error';

/**
 * エラーコンテキスト
 */
export interface ErrorContext {
  issue?: Issue;
  issueNumber?: number;
  operation?: string;
  retryCount?: number;
}

/**
 * エラー処理結果
 */
export interface HandleResult {
  retry: boolean;
  errorType: ErrorType;
  errorMessage: string;
}

/**
 * エラーハンドラー
 */
export class ErrorHandler {
  /**
   * エラーを分類
   */
  classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('git')) {
      return 'git_error';
    }
    if (message.includes('github') || message.includes('octokit')) {
      return 'github_api_error';
    }
    if (message.includes('claude') || message.includes('anthropic')) {
      return 'claude_api_error';
    }
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return 'network_error';
    }
    if (message.includes('timeout')) {
      return 'timeout_error';
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation_error';
    }

    return 'unknown_error';
  }

  /**
   * エラーがリトライ可能かどうか
   */
  isRetryable(errorType: ErrorType): boolean {
    const retryableErrors: ErrorType[] = [
      'network_error',
      'timeout_error',
      'github_api_error',
      'claude_api_error',
    ];

    return retryableErrors.includes(errorType);
  }

  /**
   * エラーメッセージをフォーマット
   */
  formatErrorMessage(error: Error, errorType: ErrorType, context: ErrorContext): string {
    const parts: string[] = [];

    parts.push(`**Error Type**: ${errorType}`);
    parts.push(`**Error Message**: ${error.message}`);

    if (context.operation) {
      parts.push(`**Operation**: ${context.operation}`);
    }

    if (context.retryCount !== undefined && context.retryCount > 0) {
      parts.push(`**Retry Count**: ${context.retryCount}`);
    }

    if (error.stack) {
      parts.push(`\n**Stack Trace**:\n\`\`\`\n${error.stack.split('\n').slice(0, 10).join('\n')}\n\`\`\``);
    }

    return parts.join('\n');
  }

  /**
   * エラーを処理
   */
  async handle(error: Error, context: ErrorContext): Promise<HandleResult> {
    const errorType = this.classifyError(error);
    const retryCount = context.retryCount || 0;

    // ログ記録
    logger.error('Error occurred', {
      errorType,
      message: error.message,
      stack: error.stack,
      context,
    });

    const result: HandleResult = {
      retry: false,
      errorType,
      errorMessage: error.message,
    };

    // リトライ判定
    if (this.isRetryable(errorType) && retryCount < 3) {
      logger.info(`Retrying... (attempt ${retryCount + 1}/3)`);
      result.retry = true;
    }

    return result;
  }

  /**
   * エラーラベルを取得
   */
  getErrorLabel(errorType: ErrorType): string {
    const labelMap: Record<ErrorType, string> = {
      git_error: 'claude-error:git',
      github_api_error: 'claude-error:github',
      claude_api_error: 'claude-error:claude',
      network_error: 'claude-error:network',
      validation_error: 'claude-error:validation',
      timeout_error: 'claude-error:timeout',
      unknown_error: 'claude-failed',
    };

    return labelMap[errorType] || 'claude-failed';
  }
}
