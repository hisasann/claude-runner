import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import type { ClaudeConfig } from '../types/config.js';
import type { Issue } from '../types/github.js';
import type { ImplementResult, ReviewResult } from '../types/claude.js';
import { getLogger } from '../utils/logger.js';
import { FILE_TOOLS, executeTool } from './tools.js';

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
   * Issueを実装（Tool useループ付き）
   */
  async implement(issue: Issue, worktreePath: string): Promise<ImplementResult> {
    const initialPrompt = this.buildImplementPrompt(issue, worktreePath);

    try {
      logger.info(`Claude: Implementing issue #${issue.number}`);
      logger.debug(`Prompt length: ${initialPrompt.length} characters`);

      // 会話履歴を保持
      const messages: MessageParam[] = [
        {
          role: 'user',
          content: initialPrompt,
        },
      ];

      let totalTokens = 0;
      let iterations = 0;
      const maxIterations = 20; // 無限ループ防止
      let filesChanged = 0;

      // Tool useループ
      while (iterations < maxIterations) {
        iterations++;
        logger.debug(`Claude: Iteration ${iterations}`);

        const message = await this.anthropic.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          tools: FILE_TOOLS,
          messages,
        });

        totalTokens += message.usage.input_tokens + message.usage.output_tokens;

        logger.debug(`Claude: Stop reason: ${message.stop_reason}`);

        // Tool useブロックを処理
        const toolUseBlocks = message.content.filter((block) => block.type === 'tool_use');

        if (toolUseBlocks.length === 0) {
          // ツール使用なし = 完了
          const textContent = message.content.find((block) => block.type === 'text');
          const responseText = textContent && 'text' in textContent ? textContent.text : '';

          logger.info(`Claude: Implementation completed`, {
            iterations,
            filesChanged,
            totalTokens,
            stopReason: message.stop_reason,
          });

          return {
            success: true,
            filesChanged,
            message: responseText,
            tokensUsed: totalTokens,
          };
        }

        // Assistantの応答を会話履歴に追加
        messages.push({
          role: 'assistant',
          content: message.content,
        });

        // 各ツールを実行
        const toolResults = [];
        for (const block of toolUseBlocks) {
          if (block.type !== 'tool_use') continue;

          const toolName = block.name;
          const toolInput = block.input;
          const toolUseId = block.id;

          logger.info(`Claude: Using tool: ${toolName}`, { input: toolInput });

          try {
            const result = await executeTool(toolName, toolInput, worktreePath);

            // write_fileの場合はファイル変更をカウント
            if (toolName === 'write_file') {
              filesChanged++;
            }

            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: toolUseId,
              content: result,
            });

            logger.debug(`Claude: Tool result: ${result.substring(0, 100)}...`);
          } catch (error: any) {
            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: toolUseId,
              content: `Error: ${error.message}`,
              is_error: true,
            });

            logger.error(`Claude: Tool execution failed`, { toolName, error: error.message });
          }
        }

        // Tool resultsを会話履歴に追加
        messages.push({
          role: 'user',
          content: toolResults,
        });
      }

      // 最大イテレーション到達
      logger.warn(`Claude: Max iterations reached (${maxIterations})`);

      return {
        success: false,
        filesChanged,
        message: `Implementation incomplete: reached max iterations (${maxIterations})`,
        tokensUsed: totalTokens,
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

# Available Tools
You have access to the following file operation tools:
- read_file: Read file contents
- write_file: Create or overwrite a file
- list_directory: List files and directories
- create_directory: Create a directory

# Requirements
- Use the tools to implement the changes directly
- Follow existing code style and architecture (use read_file to check existing code)
- Add tests if the issue requests it
- Consider edge cases
- Pay attention to security (avoid XSS, SQL injection, etc.)
- Keep the implementation simple and focused

# Instructions
1. First, use list_directory and read_file to explore the project structure if needed
2. Create or modify the necessary files using write_file
3. When done, provide a brief summary of what you implemented

Please proceed with the implementation.`;
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
