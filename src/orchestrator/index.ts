import path from 'path';
import type { Config, RunOptions } from '../types/config.js';
import type { Issue } from '../types/github.js';
import type { Report } from '../types/index.js';
import { GitHubClient } from '../github/client.js';
import { GitManager } from '../git/manager.js';
import { ClaudeClient } from '../claude/client.js';
import { Statistics } from '../utils/statistics.js';
import { ErrorHandler } from '../utils/error.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class Orchestrator {
  private config: Config;
  private githubClient: GitHubClient;
  private gitManager: GitManager;
  private claudeClient: ClaudeClient;
  private stats: Statistics;
  private errorHandler: ErrorHandler;

  constructor(config: Config) {
    this.config = config;
    this.githubClient = new GitHubClient(config.github);
    this.gitManager = new GitManager(config.git);
    this.claudeClient = new ClaudeClient(config.claude);
    this.stats = new Statistics();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * メインの実行フロー
   */
  async run(options: RunOptions): Promise<Report> {
    logger.info('Orchestrator: Starting execution');

    try {
      // Issue取得
      const issues = await this.fetchIssues(options);

      if (issues.length === 0) {
        logger.info('No issues to process');
        console.log('\nNo issues found to process.\n');
        return this.stats.generateReport();
      }

      logger.info(`Found ${issues.length} issue(s) to process`);

      // 各Issueを処理
      for (const issue of issues) {
        await this.processIssue(issue, options);
      }

      // レポート生成
      const report = this.stats.generateReport();
      this.stats.printReport(report);

      // レポート保存
      try {
        const reportFile = await this.stats.saveReport(report, this.config.logging?.outputDir || 'logs');
        logger.info(`Report saved to: ${reportFile}`);
      } catch (error) {
        logger.warn('Failed to save report, but continuing...');
      }

      return report;
    } catch (error) {
      logger.error('Orchestrator: Fatal error', { error });
      throw error;
    }
  }

  /**
   * Issueを取得（一覧 or 単一）
   */
  private async fetchIssues(options: RunOptions): Promise<Issue[]> {
    // 特定Issue指定の場合
    if (options.issue) {
      const issueNumber = parseInt(options.issue, 10);
      logger.info(`Fetching specific issue #${issueNumber}`);

      const issue = await this.githubClient.getIssue(issueNumber);

      if (issue.state !== 'open') {
        throw new Error(`Issue #${issueNumber} is not open`);
      }

      logger.info(`✓ Issue #${issue.number}: ${issue.title}`);
      return [issue];
    }

    // 一覧取得（通常モード）
    logger.info('Fetching issues with labels:', this.config.github.labels);

    const issues = await this.githubClient.getIssues(this.config.github.labels);
    const filtered = this.filterIssues(issues);

    logger.info(`Filtered to ${filtered.length} issue(s)`);

    return filtered;
  }

  /**
   * Issueをフィルタリング
   */
  private filterIssues(issues: Issue[]): Issue[] {
    let filtered = issues;

    // 除外ラベルでフィルタ
    if (this.config.github.excludeLabels && this.config.github.excludeLabels.length > 0) {
      filtered = filtered.filter((issue) => {
        const hasExcludedLabel = issue.labels.some((label) =>
          this.config.github.excludeLabels?.includes(label.name)
        );
        return !hasExcludedLabel;
      });
    }

    // アサイン済みを除外
    filtered = filtered.filter((issue) => !issue.assignee);

    // 処理済み・失敗済みを除外
    filtered = filtered.filter((issue) => {
      const hasProcessingLabel = issue.labels.some((label) =>
        ['claude-processing', 'claude-completed', 'claude-failed'].includes(label.name)
      );
      return !hasProcessingLabel;
    });

    return filtered;
  }

  /**
   * 単一のIssueを処理
   */
  private async processIssue(issue: Issue, options: RunOptions): Promise<void> {
    const startTime = Date.now();
    const issueNumber = issue.number;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing Issue #${issueNumber}: ${issue.title}`);
    console.log(`${'='.repeat(60)}\n`);

    logger.info(`Processing issue #${issueNumber}`);

    // 処理中ラベルを追加
    await this.githubClient.addLabel(issueNumber, 'claude-processing');

    // Worktreeパスとブランチ名
    const worktreePath = path.join(this.config.git.worktreeDir, `issue-${issueNumber}`);
    const branchName = `${this.config.git.branchPrefix}${issueNumber}`;

    try {
      // 1. Worktree作成
      console.log('1. Creating worktree...');
      await this.gitManager.createWorktree({
        branch: branchName,
        path: worktreePath,
        baseBranch: this.config.git.baseBranch,
      });
      console.log('✓ Worktree created\n');

      // 2. Claude で実装
      console.log('2. Implementing with Claude...');
      const implementResult = await this.claudeClient.implement(issue, worktreePath);
      console.log(`✓ Implementation completed (${implementResult.tokensUsed} tokens, ${implementResult.filesChanged} files)\n`);

      // 3. 変更があるかチェック
      const hasChanges = await this.gitManager.hasChanges(worktreePath);
      if (!hasChanges) {
        console.log('⚠️  No changes detected, skipping commit\n');
        throw new Error('No changes were made');
      }

      // 4. コミット
      console.log('3. Creating commit...');
      await this.gitManager.stageAll(worktreePath);

      const commitMessage = this.buildCommitMessage(issue);
      await this.gitManager.commit(worktreePath, commitMessage);
      console.log('✓ Commit created\n');

      // 5. Push（オプション）
      if (this.config.workflow.autoPush || options.push) {
        console.log('4. Pushing to remote...');
        await this.gitManager.push(worktreePath, 'origin', branchName);
        console.log('✓ Pushed to remote\n');
      } else {
        console.log('⊘ Skipping push (autoPush is disabled)\n');
      }

      // 6. PR作成（オプション）
      let prUrl: string | undefined;
      if (this.config.workflow.autoCreatePR && options.pr !== false) {
        console.log('5. Creating pull request...');
        const pr = await this.githubClient.createPR({
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          title: `Fix #${issueNumber}: ${issue.title}`,
          body: this.buildPRBody(issue),
          head: branchName,
          base: this.config.git.baseBranch,
        });
        prUrl = pr.html_url;
        console.log(`✓ PR created: ${pr.html_url}\n`);
      } else {
        console.log('⊘ Skipping PR creation\n');
      }

      // 成功ラベル
      await this.githubClient.removeLabel(issueNumber, 'claude-processing');
      await this.githubClient.addLabel(issueNumber, 'claude-completed');

      const duration = Date.now() - startTime;
      this.stats.recordSuccess(issueNumber, duration, prUrl);

      console.log(`✅ Issue #${issueNumber} completed in ${Math.floor(duration / 1000)}s\n`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // エラーハンドラーでエラーを処理
      const handleResult = await this.errorHandler.handle(error, {
        issue,
        issueNumber,
        operation: 'processIssue',
      });

      // 失敗ラベル
      await this.githubClient.removeLabel(issueNumber, 'claude-processing');
      const errorLabel = this.errorHandler.getErrorLabel(handleResult.errorType);
      await this.githubClient.addLabel(issueNumber, errorLabel);

      // Issueにコメント
      const errorMessage = this.errorHandler.formatErrorMessage(error, handleResult.errorType, {
        issue,
        issueNumber,
        operation: 'processIssue',
      });

      await this.githubClient.addComment(
        issueNumber,
        `⚠️ Automated implementation failed\n\n${errorMessage}\n\nPlease check the logs for details.`
      );

      this.stats.recordFailure(issueNumber, handleResult.errorType, duration, error.message);

      console.error(`❌ Issue #${issueNumber} failed: ${handleResult.errorType} - ${error.message}\n`);
    } finally {
      // Worktree削除
      try {
        await this.gitManager.removeWorktree(worktreePath);
        logger.debug(`Cleaned up worktree: ${worktreePath}`);
      } catch (error) {
        logger.warn(`Failed to clean up worktree: ${worktreePath}`);
      }
    }
  }

  /**
   * コミットメッセージを構築
   */
  private buildCommitMessage(issue: Issue): string {
    const template =
      this.config.git.commitMessageTemplate ||
      `Fix #{{issue_number}}: {{issue_title}}\n\n{{issue_body}}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`;

    return template
      .replace(/\{\{issue_number\}\}/g, issue.number.toString())
      .replace(/\{\{issue_title\}\}/g, issue.title)
      .replace(/\{\{issue_body\}\}/g, this.truncate(issue.body || '', 200));
  }

  /**
   * PR本文を構築
   */
  private buildPRBody(issue: Issue): string {
    return `Closes #${issue.number}

## Summary
${issue.body || 'No description provided'}

## Implementation
Automated implementation by Claude Runner.

---
🤖 Generated by [Claude Runner](https://github.com/hisasann/claude-runner)`;
  }

  /**
   * テキストを切り詰め
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
