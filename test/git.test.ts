#!/usr/bin/env node

import fs from 'fs/promises';
import { GitManager } from '../src/git/manager.js';
import { initLogger } from '../src/utils/logger.js';

const logger = initLogger({ level: 'debug', outputDir: 'logs' });

async function testGitOperations() {
  console.log('Git Manager Test - Starting...\n');

  const gitManager = new GitManager({
    baseBranch: 'main',
    worktreeDir: '.worktrees',
    branchPrefix: 'test/',
  });

  const testWorktreePath = '.worktrees/test-issue-999';
  const testBranch = 'test/issue-999';

  try {
    // 1. Worktree作成
    console.log('1. Creating worktree...');
    await gitManager.createWorktree({
      branch: testBranch,
      path: testWorktreePath,
      baseBranch: 'main',
    });
    console.log('✓ Worktree created\n');

    // 2. 現在のブランチ確認
    console.log('2. Checking current branch...');
    const currentBranch = await gitManager.getCurrentBranch(testWorktreePath);
    console.log(`✓ Current branch: ${currentBranch}\n`);

    // 3. テストファイルを作成
    console.log('3. Creating test file...');
    await fs.writeFile(
      `${testWorktreePath}/test-file.txt`,
      'Hello from Claude Runner test!'
    );
    console.log('✓ Test file created\n');

    // 4. 変更があるかチェック
    console.log('4. Checking for changes...');
    const hasChanges = await gitManager.hasChanges(testWorktreePath);
    console.log(`✓ Has changes: ${hasChanges}\n`);

    // 5. Diff取得
    console.log('5. Getting diff...');
    await gitManager.stageAll(testWorktreePath);
    const diff = await gitManager.getDiff(testWorktreePath);
    console.log(`✓ Diff length: ${diff.length} characters`);
    console.log(`Diff preview:\n${diff.substring(0, 200)}...\n`);

    // 6. コミット
    console.log('6. Creating commit...');
    await gitManager.commit(
      testWorktreePath,
      'test: add test file\n\nThis is a test commit from claude-runner'
    );
    console.log('✓ Commit created\n');

    // 7. Worktree削除
    console.log('7. Removing worktree...');
    await gitManager.removeWorktree(testWorktreePath);
    console.log('✓ Worktree removed\n');

    // 8. ブランチを削除
    console.log('8. Cleaning up test branch...');
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`git branch -D ${testBranch}`);
      console.log('✓ Test branch deleted\n');
    } catch (error) {
      console.log('- Test branch cleanup skipped (already deleted)\n');
    }

    console.log('✅ All tests passed!');
    logger.info('Git operations test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Git operations test failed', { error });

    // クリーンアップを試みる
    try {
      await gitManager.removeWorktree(testWorktreePath);
    } catch {
      // 無視
    }

    process.exit(1);
  }
}

testGitOperations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
