import { Octokit } from '@octokit/rest';
import type { GitHubConfig } from '../types/config.js';
import type { Issue, PullRequest, PRParams } from '../types/github.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.token,
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          logger.warn(
            `GitHub APIレート制限到達、${retryAfter}秒後にリトライします: ${options.method} ${options.url}`
          );
          return true; // リトライする
        },
        onSecondaryRateLimit: (_retryAfter: number, options: any) => {
          logger.warn(`GitHub API二次レート制限到達: ${options.method} ${options.url}`);
          return true;
        },
      },
    });
  }

  /**
   * Issue一覧を取得
   */
  async getIssues(labels: string[]): Promise<Issue[]> {
    try {
      const issues = await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
        owner: this.config.owner,
        repo: this.config.repo,
        state: 'open',
        labels: labels.join(','),
        sort: 'created',
        direction: 'asc',
        per_page: 100,
      });

      const filtered = (issues as Issue[]).filter((issue) => !issue.pull_request);

      logger.info(`GitHub: ${filtered.length}件のIssueを取得しました`);
      return filtered;
    } catch (error) {
      logger.error('GitHub: Issue一覧の取得に失敗', { error });
      throw new Error(`GitHub APIエラー: ${error}`);
    }
  }

  /**
   * 特定のIssueを取得
   */
  async getIssue(issueNumber: number): Promise<Issue> {
    try {
      const response = await this.octokit.rest.issues.get({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
      });

      logger.info(`GitHub: Issue #${issueNumber} を取得しました`);
      const issue = response.data as Issue;
      if (issue.pull_request) {
        throw new Error(`Issue #${issueNumber} is a pull request, not an issue`);
      }
      return issue;
    } catch (error) {
      logger.error(`GitHub: Issue #${issueNumber} の取得に失敗`, { error });
      throw new Error(`GitHub APIエラー: ${error}`);
    }
  }

  /**
   * プルリクエストを作成
   */
  async createPR(params: PRParams): Promise<PullRequest> {
    try {
      const response = await this.octokit.rest.pulls.create({
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
      });

      logger.info(`GitHub: PR #${response.data.number} を作成しました`, {
        url: response.data.html_url,
      });
      return response.data as PullRequest;
    } catch (error) {
      logger.error('GitHub: PRの作成に失敗', { error, params });
      throw new Error(`GitHub APIエラー: ${error}`);
    }
  }

  /**
   * Issueにコメントを追加
   */
  async addComment(issueNumber: number, body: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        body,
      });

      logger.info(`GitHub: Issue #${issueNumber} にコメントを追加しました`);
    } catch (error) {
      logger.error(`GitHub: Issue #${issueNumber} へのコメント追加に失敗`, { error });
      throw new Error(`GitHub APIエラー: ${error}`);
    }
  }

  /**
   * Issueにラベルを追加
   */
  async addLabel(issueNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.rest.issues.addLabels({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        labels: [label],
      });

      logger.info(`GitHub: Issue #${issueNumber} にラベル「${label}」を追加しました`);
    } catch (error) {
      logger.error(`GitHub: Issue #${issueNumber} へのラベル追加に失敗`, { error, label });
      // ラベルの追加失敗は致命的ではないのでエラーを投げない
      logger.warn(`ラベル追加をスキップします: ${label}`);
    }
  }

  /**
   * Issueからラベルを削除
   */
  async removeLabel(issueNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.rest.issues.removeLabel({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        name: label,
      });

      logger.info(`GitHub: Issue #${issueNumber} からラベル「${label}」を削除しました`);
    } catch (error) {
      logger.error(`GitHub: Issue #${issueNumber} からのラベル削除に失敗`, { error, label });
      // ラベルの削除失敗は致命的ではないのでエラーを投げない
      logger.warn(`ラベル削除をスキップします: ${label}`);
    }
  }

  /**
   * ラベルを作成
   */
  async createLabel(name: string, color: string, description: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createLabel({
        owner: this.config.owner,
        repo: this.config.repo,
        name,
        color,
        description,
      });

      logger.info(`GitHub: ラベル「${name}」を作成しました`);
    } catch (error: any) {
      if (error.status === 422) {
        // 既に存在する
        logger.info(`GitHub: ラベル「${name}」は既に存在します`);
      } else {
        logger.error(`GitHub: ラベル「${name}」の作成に失敗`, { error });
        throw new Error(`GitHub APIエラー: ${error}`);
      }
    }
  }
}
