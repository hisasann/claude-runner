#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { initLogger } from './utils/logger.js';
import { Orchestrator } from './orchestrator/index.js';
import type { RunOptions } from './types/config.js';

const program = new Command();

program
  .name('claude-runner')
  .description('Automated GitHub issue implementation with Claude AI')
  .version('0.1.0');

program
  .option('-c, --config <path>', 'Path to config file', 'config.yaml')
  .option('-i, --issue <number>', 'Process specific issue only')
  .option('--dry-run', 'Dry run mode (no actual changes)')
  .option('--no-push', 'Disable push to remote')
  .option('--no-pr', 'Disable PR creation')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (options) => {
    try {
      await main(options);
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

async function main(options: RunOptions) {
  console.log('🤖 Claude Runner - Starting...\n');

  // 設定読み込み
  console.log('Loading configuration...');
  const config = await loadConfig(options.config);
  console.log('✓ Configuration loaded\n');

  // ロガー初期化
  const logLevel = options.verbose ? 'debug' : config.logging?.level || 'info';
  const loggingConfig = {
    level: logLevel as any,
    outputDir: config.logging?.outputDir || 'logs',
    maxFiles: config.logging?.maxFiles || 7,
    maxSize: config.logging?.maxSize || '10m',
  };
  initLogger(loggingConfig);

  console.log('Repository:', `${config.github.owner}/${config.github.repo}`);
  console.log('Labels:', config.github.labels.join(', '));
  console.log('Model:', config.claude.model);

  if (options.issue) {
    console.log('Processing specific issue:', `#${options.issue}`);
  }

  if (options.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No actual changes will be made\n');
  }

  console.log();

  // Orchestrator実行
  const orchestrator = new Orchestrator(config);
  await orchestrator.run(options);
}

program.parse();
