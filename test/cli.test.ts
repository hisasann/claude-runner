#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function testCliRequiresExplicitIssues() {
  console.log('CLI Test - Starting...\n');

  const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(workspaceRoot, '..');
  const tempDir = path.join(repoRoot, '.claude-test');
  const configPath = path.join(tempDir, 'cli-config.yaml');

  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(
    configPath,
    [
      'github:',
      '  owner: "test-owner"',
      '  repo: "test-repo"',
      '  token: "ghp_dummytesttoken"',
      '  labels:',
      '    - "claude-auto"',
      'git:',
      '  baseBranch: "main"',
      '  worktreeDir: ".worktrees"',
      '  branchPrefix: "claude/issue-"',
      'claude:',
      '  apiKey: "sk-ant-dummytestkey"',
      '  model: "claude-3-5-haiku-20241022"',
      '  maxRetries: 0',
      '  timeout: 10000',
      '  temperature: 0.0',
      '  maxTokens: 2000',
      'workflow:',
      '  autoReview: false',
      '  reviewIterations: 0',
      '  autoCreatePR: false',
      '  autoPush: false',
      '  maxConcurrency: 1',
      '  runTests: false',
      '  testCommand: "npm test"',
      '  buildBeforeTest: false',
      '  buildCommand: "npm run build"',
      '',
    ].join('\n'),
    'utf-8'
  );

  const tsxPath = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const cliPath = path.join(repoRoot, 'src', 'cli.ts');

  try {
    await execFileAsync('node', [tsxPath, cliPath, '--config', configPath], {
      cwd: repoRoot,
      timeout: 20000,
      env: { ...process.env },
    });
    console.error('❌ Test failed: CLI should have exited with an error');
    process.exit(1);
  } catch (error: any) {
    const output = `${error.stdout || ''}${error.stderr || ''}`;
    if (!output.includes('No issues specified')) {
      console.error('❌ Test failed: unexpected error output');
      console.error(output);
      process.exit(1);
    }
  }

  console.log('✅ CLI explicit-issue requirement test passed!');
}

testCliRequiresExplicitIssues().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
