#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { ClaudeClient } from '../src/claude/client.js';
import { loadConfig } from '../src/config/loader.js';
import { initLogger } from '../src/utils/logger.js';
import type { Issue } from '../src/types/github.js';

const logger = initLogger({ level: 'info', outputDir: 'logs' });

async function testClaudeOperations() {
  console.log('Claude Client Test - Starting...\n');

  try {
    // 設定読み込み
    const config = await loadConfig('claude-runner.yaml');
    const claudeClient = new ClaudeClient(config.claude);

    const baseWorkDir = path.resolve('.claude-test');
    await fs.rm(baseWorkDir, { recursive: true, force: true });
    await fs.mkdir(baseWorkDir, { recursive: true });

    // テスト用のIssue（加算）
    const addIssue: Issue = {
      number: 999,
      title: 'Create a simple addition function',
      body:
        'Create `src/utils/add.ts` with a function called `add` that takes two numbers and returns their sum. Add tests in `test/utils/add.test.ts`.',
      state: 'open',
      labels: [{ name: 'test', color: '000000', description: null }],
      assignee: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: 'https://github.com/test/test/issues/999',
    };

    // テスト用のIssue（減算）
    const subtractIssue: Issue = {
      number: 2,
      title: 'Create a simple subtraction function',
      body:
        'Create `src/utils/subtract.ts` with a function called `subtract` that takes two numbers and returns a - b. Add tests in `test/utils/subtract.test.ts`.',
      state: 'open',
      labels: [{ name: 'test', color: '000000', description: null }],
      assignee: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: 'https://github.com/test/test/issues/2',
    };

    const addDiff = `
diff --git a/add.ts b/add.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/add.ts
@@ -0,0 +1,3 @@
+export function add(a: number, b: number): number {
+  return a + b;
+}
`;

    const subtractDiff = `
diff --git a/subtract.ts b/subtract.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/subtract.ts
@@ -0,0 +1,3 @@
+export function subtract(a: number, b: number): number {
+  return a - b;
+}
`;

    const sequentialResult = await runScenario({
      claudeClient,
      addIssue,
      subtractIssue,
      addDiff,
      subtractDiff,
      workDir: path.join(baseWorkDir, 'sequential'),
      label: 'sequential',
      parallel: false,
    });

    const parallelResult = await runScenario({
      claudeClient,
      addIssue,
      subtractIssue,
      addDiff,
      subtractDiff,
      workDir: path.join(baseWorkDir, 'parallel'),
      label: 'parallel',
      parallel: true,
    });

    console.log('✅ All Claude API tests passed!');
    logger.info('Claude operations test completed successfully');

    // コスト概算
    const totalTokens =
      (sequentialResult.totalTokens || 0) + (parallelResult.totalTokens || 0);
    if (totalTokens > 0) {
      const inputCost = 1.00 / 1_000_000; // Haiku: $1.00 per 1M input tokens
      const outputCost = 5.00 / 1_000_000; // Haiku: $5.00 per 1M output tokens
      // 簡易計算（入力と出力の比率は仮定）
      const estimatedCost = (totalTokens * 3) / 1_000_000;

      console.log(`\n💰 Estimated cost for this test: $${estimatedCost.toFixed(4)}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Claude operations test failed', { error });
    process.exit(1);
  }
}

testClaudeOperations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

type ScenarioOptions = {
  claudeClient: ClaudeClient;
  addIssue: Issue;
  subtractIssue: Issue;
  addDiff: string;
  subtractDiff: string;
  workDir: string;
  label: string;
  parallel: boolean;
};

async function runScenario(options: ScenarioOptions): Promise<{ totalTokens: number }> {
  const { claudeClient, addIssue, subtractIssue, addDiff, subtractDiff, workDir, label, parallel } =
    options;

  await fs.mkdir(workDir, { recursive: true });

  if (parallel) {
    console.log(`1. Testing implementation (add + subtract) [${label}]...`);
    const [addImplementResult, subtractImplementResult] = await Promise.all([
      claudeClient.implement(addIssue, workDir),
      claudeClient.implement(subtractIssue, workDir),
    ]);

    console.log(`✓ Implementation completed [${label}]`);
    console.log(`  Add tokens: ${addImplementResult.tokensUsed}`);
    console.log(`  Subtract tokens: ${subtractImplementResult.tokensUsed}`);

    console.log(`2. Testing review (add + subtract) [${label}]...`);
    const [addReviewResult, subtractReviewResult] = await Promise.all([
      claudeClient.review(addDiff, addIssue),
      claudeClient.review(subtractDiff, subtractIssue),
    ]);

    console.log(`✓ Review completed [${label}]`);
    console.log(`  Add approved: ${addReviewResult.approved}`);
    console.log(`  Subtract approved: ${subtractReviewResult.approved}`);

    const totalTokens =
      (addImplementResult.tokensUsed || 0) + (subtractImplementResult.tokensUsed || 0);
    console.log();
    return { totalTokens };
  }

  console.log(`1. Testing implementation (add) [${label}]...`);
  console.log(`   Issue: ${addIssue.title}`);
  const addImplementResult = await claudeClient.implement(addIssue, workDir);
  console.log(`✓ Implementation completed [${label}]`);
  console.log(`  Tokens used: ${addImplementResult.tokensUsed}`);
  console.log(`  Response preview: ${addImplementResult.message?.substring(0, 200)}...\n`);

  console.log(`2. Testing implementation (subtract) [${label}]...`);
  console.log(`   Issue: ${subtractIssue.title}`);
  const subtractImplementResult = await claudeClient.implement(subtractIssue, workDir);
  console.log(`✓ Implementation completed [${label}]`);
  console.log(`  Tokens used: ${subtractImplementResult.tokensUsed}`);
  console.log(`  Response preview: ${subtractImplementResult.message?.substring(0, 200)}...\n`);

  console.log(`3. Testing review (add) [${label}]...`);
  const addReviewResult = await claudeClient.review(addDiff, addIssue);
  console.log(`✓ Review completed [${label}]`);
  console.log(`  Has issues: ${addReviewResult.hasIssues}`);
  console.log(`  Approved: ${addReviewResult.approved}`);
  if (addReviewResult.issues.length > 0) {
    console.log(`  Issues found: ${addReviewResult.issues.length}`);
    console.log(`  First issue: ${addReviewResult.issues[0]?.substring(0, 100)}...`);
  }
  console.log();

  console.log(`4. Testing review (subtract) [${label}]...`);
  const subtractReviewResult = await claudeClient.review(subtractDiff, subtractIssue);
  console.log(`✓ Review completed [${label}]`);
  console.log(`  Has issues: ${subtractReviewResult.hasIssues}`);
  console.log(`  Approved: ${subtractReviewResult.approved}`);
  if (subtractReviewResult.issues.length > 0) {
    console.log(`  Issues found: ${subtractReviewResult.issues.length}`);
    console.log(`  First issue: ${subtractReviewResult.issues[0]?.substring(0, 100)}...`);
  }
  console.log();

  const totalTokens =
    (addImplementResult.tokensUsed || 0) + (subtractImplementResult.tokensUsed || 0);
  return { totalTokens };
}
