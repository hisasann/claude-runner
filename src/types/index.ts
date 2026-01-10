export * from './config.js';
export * from './github.js';
export * from './claude.js';

export interface ProcessResult {
  success: boolean;
  issueNumber: number;
  duration: number;
  error?: string;
  errorType?: ErrorType;
  prUrl?: string;
}

export interface Report {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  averageTime: number;
  totalTime: number;
  results: ProcessResult[];
}

export type ErrorType =
  | 'test-failure'
  | 'build-error'
  | 'git-error'
  | 'claude-api-error'
  | 'github-api-error'
  | 'timeout'
  | 'unknown';

export interface Context {
  config: import('./config.js').Config;
  githubClient: any; // 後で型を追加
  gitManager: any; // 後で型を追加
  claudeClient: any; // 後で型を追加
  stats: any; // 後で型を追加
}
