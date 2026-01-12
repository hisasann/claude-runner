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
  | 'git_error'
  | 'github_api_error'
  | 'claude_api_error'
  | 'test_error'
  | 'build_error'
  | 'network_error'
  | 'validation_error'
  | 'timeout_error'
  | 'unknown_error';

export interface Context {
  config: import('./config.js').Config;
  githubClient: any; // 後で型を追加
  gitManager: any; // 後で型を追加
  claudeClient: any; // 後で型を追加
  stats: any; // 後で型を追加
}
