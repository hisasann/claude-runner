import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { GitConfig } from '../types/config.js';
import { getLogger } from '../utils/logger.js';

const execAsync = promisify(exec);
const logger = getLogger();

export interface WorktreeOptions {
  branch: string;
  path: string;
  baseBranch: string;
}

export class GitManager {
  constructor(_config: GitConfig) {
    // 将来の拡張のために保持
  }

  /**
   * Worktreeを作成
   */
  async createWorktree(options: WorktreeOptions): Promise<void> {
    const { branch, path: worktreePath, baseBranch } = options;

    try {
      // 既にディレクトリが存在する場合は削除
      try {
        await fs.access(worktreePath);
        logger.warn(`Worktree already exists, removing: ${worktreePath}`);
        await this.removeWorktree(worktreePath);
      } catch {
        // ディレクトリが存在しない場合は何もしない
      }

      // Worktreeディレクトリの親ディレクトリを作成
      const parentDir = path.dirname(worktreePath);
      await fs.mkdir(parentDir, { recursive: true });

      // Worktreeを作成
      const command = `git worktree add "${worktreePath}" -b "${branch}" "${baseBranch}"`;
      logger.debug(`Executing: ${command}`);

      const { stderr } = await execAsync(command);

      if (stderr && !stderr.includes('Preparing worktree')) {
        logger.warn(`Git worktree stderr: ${stderr}`);
      }

      logger.info(`Worktree created: ${worktreePath} (branch: ${branch})`);
    } catch (error: any) {
      logger.error(`Failed to create worktree: ${error.message}`);
      throw new Error(`Git worktree creation failed: ${error.message}`);
    }
  }

  /**
   * Worktreeを削除
   */
  async removeWorktree(worktreePath: string): Promise<void> {
    try {
      // Worktreeを削除
      const command = `git worktree remove "${worktreePath}" --force`;
      logger.debug(`Executing: ${command}`);

      await execAsync(command);

      logger.info(`Worktree removed: ${worktreePath}`);
    } catch (error: any) {
      // worktreeが存在しない場合はエラーを無視
      if (error.message.includes('is not a working tree')) {
        logger.debug(`Worktree does not exist: ${worktreePath}`);
        return;
      }

      logger.error(`Failed to remove worktree: ${error.message}`);
      throw new Error(`Git worktree removal failed: ${error.message}`);
    }
  }

  /**
   * 変更があるかチェック
   */
  async hasChanges(worktreePath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: worktreePath,
      });

      return stdout.trim().length > 0;
    } catch (error: any) {
      logger.error(`Failed to check changes: ${error.message}`);
      throw new Error(`Git status check failed: ${error.message}`);
    }
  }

  /**
   * Diffを取得
   */
  async getDiff(worktreePath: string): Promise<string> {
    try {
      // ステージングされていない変更も含めて取得
      const { stdout } = await execAsync('git diff HEAD', {
        cwd: worktreePath,
      });

      return stdout;
    } catch (error: any) {
      logger.error(`Failed to get diff: ${error.message}`);
      throw new Error(`Git diff failed: ${error.message}`);
    }
  }

  /**
   * 全ての変更をステージング
   */
  async stageAll(worktreePath: string): Promise<void> {
    try {
      await execAsync('git add -A', {
        cwd: worktreePath,
      });

      logger.info(`Staged all changes in: ${worktreePath}`);
    } catch (error: any) {
      logger.error(`Failed to stage changes: ${error.message}`);
      throw new Error(`Git add failed: ${error.message}`);
    }
  }

  /**
   * コミットを作成
   */
  async commit(worktreePath: string, message: string): Promise<void> {
    try {
      // HEREDOCを使ってコミットメッセージを渡す
      const command = `git commit -m "$(cat <<'EOF'\n${message}\nEOF\n)"`;
      logger.debug(`Executing commit in: ${worktreePath}`);

      await execAsync(command, {
        cwd: worktreePath,
      });

      logger.info(`Committed changes in: ${worktreePath}`);
    } catch (error: any) {
      logger.error(`Failed to commit: ${error.message}`);
      throw new Error(`Git commit failed: ${error.message}`);
    }
  }

  /**
   * リモートにプッシュ
   */
  async push(
    worktreePath: string,
    remote: string,
    branch: string,
    options?: { force?: boolean }
  ): Promise<void> {
    try {
      const forceFlag = options?.force ? '--force' : '';
      const command = `git push ${forceFlag} -u ${remote} ${branch}`;
      logger.debug(`Executing: ${command}`);

      await execAsync(command, {
        cwd: worktreePath,
      });

      logger.info(`Pushed to ${remote}/${branch}`);
    } catch (error: any) {
      logger.error(`Failed to push: ${error.message}`);
      throw new Error(`Git push failed: ${error.message}`);
    }
  }

  /**
   * 現在のブランチ名を取得
   */
  async getCurrentBranch(worktreePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: worktreePath,
      });

      return stdout.trim();
    } catch (error: any) {
      logger.error(`Failed to get current branch: ${error.message}`);
      throw new Error(`Git branch check failed: ${error.message}`);
    }
  }

  /**
   * ブランチが存在するかチェック
   */
  async branchExists(branch: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`git branch --list ${branch}`);
      return stdout.trim().length > 0;
    } catch (error: any) {
      return false;
    }
  }
}
