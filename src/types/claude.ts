export interface ImplementResult {
  success: boolean;
  filesChanged: number;
  message?: string;
  tokensUsed?: number;
}

export interface ReviewResult {
  hasIssues: boolean;
  issues: string[];
  suggestions: string[];
  approved: boolean;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}
