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
  .option('-c, --config <path>', 'Path to config file', 'claude-runner.yaml')
  .option('-i, --issue <number>', 'Process specific issue(s), supports comma-separated list')
  .option('--issues <numbers>', 'Process specific issues (comma-separated list)')
  .option('--dry-run', 'Dry run mode (no actual changes)')
  .option('--no-push', 'Disable push to remote')
  .option('--no-pr', 'Disable PR creation')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (options, command) => {
    try {
      await main(options, command);
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

async function main(options: RunOptions, command: Command) {
  console.log('🤖 Claude Runner - Starting...\n');

  const normalizedOptions = normalizeOptions(options, command);

  // 設定読み込み
  console.log('Loading configuration...');
  const config = await loadConfig(normalizedOptions.config);
  console.log('✓ Configuration loaded\n');

  // ロガー初期化
  const logLevel = normalizedOptions.verbose ? 'debug' : config.logging?.level || 'info';
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

  if (normalizedOptions.issues && normalizedOptions.issues.length > 0) {
    console.log('Processing specific issues:', normalizedOptions.issues.map((id) => `#${id}`).join(', '));
  } else if (normalizedOptions.issue) {
    console.log('Processing specific issue:', `#${normalizedOptions.issue}`);
  }

  if (normalizedOptions.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No actual changes will be made\n');
  }

  console.log();

  // Orchestrator実行
  const orchestrator = new Orchestrator(config);
  await orchestrator.run(normalizedOptions);
}

function normalizeOptions(options: RunOptions, command: Command): RunOptions {
  const normalized: RunOptions = { ...options };
  const issueNumbers = new Set<number>();

  for (const number of parseIssueNumbers(options.issue)) {
    issueNumbers.add(number);
  }

  const issuesOption = (options as { issues?: string }).issues;
  for (const number of parseIssueNumbers(issuesOption)) {
    issueNumbers.add(number);
  }

  if (issueNumbers.size > 0) {
    normalized.issues = Array.from(issueNumbers);
  }

  // Commanderの--no-*はデフォルトでtrueになるため、明示指定のみ反映する
  const pushSource = command.getOptionValueSource('push');
  const prSource = command.getOptionValueSource('pr');

  if (pushSource === 'default') {
    delete normalized.push;
  }

  if (prSource === 'default') {
    delete normalized.pr;
  }

  return normalized;
}

function parseIssueNumbers(input?: string): number[] {
  if (!input) return [];
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
}

program.parse();
