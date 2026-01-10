export interface Config {
  github: GitHubConfig;
  git: GitConfig;
  claude: ClaudeConfig;
  workflow: WorkflowConfig;
  logging?: LoggingConfig;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  labels: string[];
  excludeLabels?: string[];
}

export interface GitConfig {
  baseBranch: string;
  worktreeDir: string;
  branchPrefix: string;
  commitMessageTemplate?: string;
}

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxRetries: number;
  timeout: number;
  temperature: number;
  maxTokens: number;
}

export interface WorkflowConfig {
  autoReview: boolean;
  reviewIterations: number;
  autoCreatePR: boolean;
  autoPush: boolean;
  maxConcurrency: number;
  runTests: boolean;
  testCommand: string;
  buildBeforeTest: boolean;
  buildCommand: string;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  outputDir: string;
  maxFiles: number;
  maxSize: string;
}

export interface RunOptions {
  config: string;
  issue?: string;
  dryRun?: boolean;
  push?: boolean;
  pr?: boolean;
  verbose?: boolean;
}
