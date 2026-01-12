#!/usr/bin/env node

import { loadConfig } from './config/loader.js';
import { initLogger } from './utils/logger.js';
import { Orchestrator } from './orchestrator/index.js';
import type { RunOptions } from './types/config.js';

async function main() {
  try {
    console.log('🤖 Claude Runner - Starting...\n');

    // 設定ファイル読み込み
    console.log('Loading configuration...');
    const config = await loadConfig('claude-runner.yaml');
    console.log('✓ Configuration loaded\n');

    // ロガー初期化
    initLogger(config.logging);

    console.log('Repository:', `${config.github.owner}/${config.github.repo}`);
    console.log('Labels:', config.github.labels.join(', '));
    console.log('Model:', config.claude.model);
    console.log();

    // オプション
    const options: RunOptions = {
      config: 'claude-runner.yaml',
      push: config.workflow.autoPush,
      pr: config.workflow.autoCreatePR,
    };

    // Orchestrator実行
    const orchestrator = new Orchestrator(config);
    await orchestrator.run(options);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
