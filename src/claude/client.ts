import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeConfig } from '../types/config.js';
import type { Issue } from '../types/github.js';
import type { ImplementResult, ReviewResult } from '../types/claude.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class ClaudeClient {
  private anthropic: Anthropic;
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig) {
    this.config = config;
    this.anthropic = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  }

  /**
   * Issueを実装
   */
  async implement(issue: Issue, worktreePath: string): Promise<ImplementResult> {
    const prompt = this.buildImplementPrompt(issue, worktreePath);

    try {
      logger.info(`Claude: Implementing issue #${issue.number}`);
      logger.debug(`Prompt length: ${prompt.length} characters`);

      const message = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // レスポンスからテキストを抽出
      const textContent = message.content.find((block) => block.type === 'text');
      const responseText = textContent && 'text' in textContent ? textContent.text : '';

      logger.info(`Claude: Implementation completed`, {
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        stopReason: message.stop_reason,
      });

      return {
        success: true,
        filesChanged: 0, // TODO: 実際のファイル変更数をカウント
        message: responseText,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
      };
    } catch (error: any) {
      logger.error(`Claude: Implementation failed`, { error: error.message });
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * コードをレビュー
   */
  async review(diff: string, issue: Issue): Promise<ReviewResult> {
    const prompt = this.buildReviewPrompt(diff, issue);

    try {
      logger.info(`Claude: Reviewing changes for issue #${issue.number}`);

      const message = await this.anthropic.messages.create({
        model: this.config.model,
        max_tokens: Math.floor(this.config.maxTokens / 2), // レビューは実装より短くて良い
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textContent = message.content.find((block) => block.type === 'text');
      const responseText = textContent && 'text' in textContent ? textContent.text : '';

      // レビュー結果をパース（簡易版）
      const hasIssues = responseText.toLowerCase().includes('issue') ||
                       responseText.toLowerCase().includes('problem') ||
                       responseText.toLowerCase().includes('fix');

      logger.info(`Claude: Review completed`, {
        hasIssues,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
      });

      return {
        hasIssues,
        issues: hasIssues ? [responseText] : [],
        suggestions: [],
        approved: !hasIssues,
      };
    } catch (error: any) {
      logger.error(`Claude: Review failed`, { error: error.message });
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * 実装用のプロンプトを構築
   */
  private buildImplementPrompt(issue: Issue, worktreePath: string): string {
    const issueBody = issue.body || 'No description provided';

    return `You are an expert software engineer. Implement the following GitHub issue.

# Issue Information
Issue #${issue.number}: ${issue.title}

${issueBody}

# Working Directory
${worktreePath}

# Requirements
- Follow existing code style and architecture
- Add tests if necessary
- Consider edge cases
- Pay attention to security (avoid XSS, SQL injection, etc.)
- Keep the implementation simple and focused

# Implementation
Please provide a detailed implementation plan and the code changes needed.
Explain what files need to be created or modified and what the changes should be.`;
  }

  /**
   * レビュー用のプロンプトを構築
   */
  private buildReviewPrompt(diff: string, issue: Issue): string {
    const issueBody = issue.body || 'No description provided';

    return `You are an expert code reviewer. Review the following implementation.

# Original Issue
Issue #${issue.number}: ${issue.title}

${issueBody}

# Implementation (Diff)
\`\`\`diff
${diff}
\`\`\`

# Review Criteria
- Does it meet the requirements?
- Code quality and maintainability
- Security concerns
- Test coverage
- Performance considerations

# Review
Please provide a detailed code review. If there are any issues or improvements needed, list them clearly.
If the implementation looks good, indicate approval.`;
  }
}
