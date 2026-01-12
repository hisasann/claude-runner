#!/usr/bin/env node

import { ClaudeClient } from './claude/client.js';
import { loadConfig } from './config/loader.js';
import { initLogger } from './utils/logger.js';
import type { Issue } from './types/github.js';

const logger = initLogger({ level: 'info', outputDir: 'logs' });

async function testClaudeOperations() {
  console.log('Claude Client Test - Starting...\n');

  try {
    // 設定読み込み
    const config = await loadConfig('config.yaml');
    const claudeClient = new ClaudeClient(config.claude);

    // テスト用のIssue
    const testIssue: Issue = {
      number: 999,
      title: 'Create a simple addition function',
      body: 'Create a function called `add` that takes two numbers and returns their sum. Add tests for it.',
      state: 'open',
      labels: [{ name: 'test', color: '000000', description: null }],
      assignee: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      html_url: 'https://github.com/test/test/issues/999',
    };

    // 1. 実装テスト
    console.log('1. Testing implementation...');
    console.log(`   Issue: ${testIssue.title}`);

    const implementResult = await claudeClient.implement(testIssue, './');

    console.log(`✓ Implementation completed`);
    console.log(`  Tokens used: ${implementResult.tokensUsed}`);
    console.log(`  Response preview: ${implementResult.message?.substring(0, 200)}...\n`);

    // 2. レビューテスト（仮のdiff）
    console.log('2. Testing review...');

    const testDiff = `
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

    const reviewResult = await claudeClient.review(testDiff, testIssue);

    console.log(`✓ Review completed`);
    console.log(`  Has issues: ${reviewResult.hasIssues}`);
    console.log(`  Approved: ${reviewResult.approved}`);
    if (reviewResult.issues.length > 0) {
      console.log(`  Issues found: ${reviewResult.issues.length}`);
      console.log(`  First issue: ${reviewResult.issues[0]?.substring(0, 100)}...`);
    }
    console.log();

    console.log('✅ All Claude API tests passed!');
    logger.info('Claude operations test completed successfully');

    // コスト概算
    if (implementResult.tokensUsed) {
      const inputCost = 1.00 / 1_000_000; // Haiku: $1.00 per 1M input tokens
      const outputCost = 5.00 / 1_000_000; // Haiku: $5.00 per 1M output tokens
      // 簡易計算（入力と出力の比率は仮定）
      const estimatedCost = (implementResult.tokensUsed * 3) / 1_000_000;

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
