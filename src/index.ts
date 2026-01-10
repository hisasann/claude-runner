#!/usr/bin/env node

import { loadConfig } from './config/loader.js';
import { initLogger } from './utils/logger.js';
import { GitHubClient } from './github/client.js';

async function main() {
  try {
    console.log('Claude Runner - Starting...\n');

    // 設定ファイル読み込み
    console.log('設定ファイルを読み込んでいます...');
    const config = await loadConfig('config.yaml');
    console.log('✓ 設定ファイル読み込み完了\n');

    // ロガー初期化
    const logger = initLogger(config.logging);
    logger.info('Claude Runner 起動');
    logger.info('設定:', {
      repo: `${config.github.owner}/${config.github.repo}`,
      labels: config.github.labels,
    });

    // GitHub クライアント初期化
    const githubClient = new GitHubClient(config.github);

    // Issue 取得テスト
    logger.info('Issueを取得中...');
    const issues = await githubClient.getIssues(config.github.labels);

    console.log(`\n取得したIssue: ${issues.length}件\n`);
    issues.forEach((issue) => {
      console.log(`  #${issue.number}: ${issue.title}`);
      console.log(`    Labels: ${issue.labels.map((l) => l.name).join(', ')}`);
      console.log(`    URL: ${issue.html_url}\n`);
    });

    logger.info('動作確認完了');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
