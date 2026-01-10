# ワークフロー詳細

## 全体フロー

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Runner 起動                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│ 1. 初期化フェーズ                                              │
│    - 設定ファイル読み込み                                      │
│    - 環境変数展開                                              │
│    - バリデーション                                            │
│    - クライアント初期化（GitHub, Claude）                      │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│ 2. Issue取得フェーズ                                           │
│    - 特定Issue指定の確認（--issue オプション）                 │
│    - GitHub API で Issue 取得（一覧 or 単一）                 │
│    - ラベルでフィルタリング                                    │
│    - 除外ラベルの適用                                          │
│    - 優先度でソート                                            │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│ 3. Issue処理ループ                                            │
│    ┌─────────────────────────────────────────────────────┐   │
│    │ 各 Issue について:                                   │   │
│    │   - Worktree作成                                    │   │
│    │   - 実装フェーズ ─────────┐                         │   │
│    │   - レビューフェーズ       │                         │   │
│    │   - テスト実行            │← リトライループ          │   │
│    │   - コミット              │  (reviewIterations回)   │   │
│    │   - Push（オプション）    │                         │   │
│    │   - PR作成（オプション）   │                         │   │
│    │   - Worktree削除 ─────────┘                         │   │
│    └─────────────────────────────────────────────────────┘   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────┐
│ 4. 完了・クリーンアップ                                        │
│    - 統計レポート出力                                          │
│    - 通知送信（オプション）                                    │
│    - リソース解放                                              │
└───────────────────────────────────────────────────────────────┘
```

## 1. 初期化フェーズ

### 1.1 設定ファイル読み込み

```typescript
async function initialize(): Promise<Context> {
  // 設定ファイルパスの決定
  const configPath = process.env.CLAUDE_RUNNER_CONFIG ||
                     path.join(process.cwd(), 'config.yaml');

  // YAML読み込み
  const rawConfig = await fs.readFile(configPath, 'utf-8');
  const parsedConfig = yaml.parse(rawConfig);

  // 環境変数展開
  const expandedConfig = expandEnvVars(parsedConfig);

  // バリデーション
  const config = configSchema.parse(expandedConfig);

  logger.info('設定ファイル読み込み完了', { configPath });

  return {
    config,
    githubClient: new GitHubClient(config.github),
    claudeClient: new ClaudeClient(config.claude),
    gitManager: new GitManager(config.git),
    stats: new Statistics(),
  };
}
```

### 1.2 環境変数展開

```typescript
function expandEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    // ${VAR_NAME} 形式を展開
    return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      const value = process.env[varName];
      if (!value) {
        throw new Error(`環境変数 ${varName} が設定されていません`);
      }
      return value;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(expandEnvVars);
  }

  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, expandEnvVars(v)])
    );
  }

  return obj;
}
```

### 1.3 クライアント初期化

```typescript
class GitHubClient {
  private octokit: Octokit;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({
      auth: config.token,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          logger.warn(`GitHub APIレート制限到達、${retryAfter}秒後にリトライ`);
          return true; // リトライする
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          logger.warn(`GitHub API二次レート制限到達`);
          return true;
        },
      },
    });
  }
}

class ClaudeClient {
  private anthropic: Anthropic;

  constructor(config: ClaudeConfig) {
    this.anthropic = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  }
}
```

## 2. Issue取得フェーズ

### 2.1 Issue取得（一覧 or 単一）

特定のIssue番号が指定されている場合は、そのIssueのみを取得します。

```typescript
async function fetchIssues(
  context: Context,
  options: { issueNumber?: number }
): Promise<Issue[]> {
  const { githubClient, config } = context;

  // 特定Issue番号が指定されている場合
  if (options.issueNumber) {
    logger.info(`Issue #${options.issueNumber} を取得中...`);

    const issue = await githubClient.getIssue({
      owner: config.github.owner,
      repo: config.github.repo,
      issue_number: options.issueNumber,
    });

    // Issueが閉じている場合はエラー
    if (issue.state !== 'open') {
      throw new Error(`Issue #${options.issueNumber} は既に閉じられています`);
    }

    logger.info(`✓ Issue #${issue.number}: ${issue.title}`);
    return [issue];
  }

  // 一覧取得（通常モード）
  logger.info('Issue一覧を取得中...', {
    labels: config.github.labels,
  });

  const issues = await githubClient.getIssues({
    owner: config.github.owner,
    repo: config.github.repo,
    state: 'open',
    labels: config.github.labels.join(','),
    sort: 'created',
    direction: 'asc',
    per_page: 100,
  });

  logger.info(`${issues.length} 件のIssueを取得しました`);

  return issues;
}
```

**使用例**:
```bash
# 全てのissueを処理
claude-runner --config config.yaml

# 特定のissueのみ処理
claude-runner --config config.yaml --issue 123
```

### 2.2 フィルタリングとソート

```typescript
function filterAndSortIssues(
  issues: Issue[],
  config: Config
): Issue[] {
  // 除外ラベルでフィルタ
  let filtered = issues.filter(issue => {
    const hasExcludedLabel = issue.labels.some(label =>
      config.github.excludeLabels?.includes(label.name)
    );
    return !hasExcludedLabel;
  });

  // アサイン済みを除外
  filtered = filtered.filter(issue => !issue.assignee);

  // 既に処理中/完了のものを除外
  filtered = filtered.filter(issue => {
    const hasProcessingLabel = issue.labels.some(label =>
      ['claude-processing', 'claude-completed', 'claude-failed'].includes(label.name)
    );
    return !hasProcessingLabel;
  });

  // 優先度でソート（ラベルに priority-high などがあれば優先）
  const sorted = filtered.sort((a, b) => {
    const aPriority = getPriority(a);
    const bPriority = getPriority(b);
    return bPriority - aPriority; // 高い優先度が先
  });

  logger.info(`フィルタリング後: ${sorted.length} 件のIssue`);

  return sorted;
}

function getPriority(issue: Issue): number {
  if (issue.labels.some(l => l.name === 'priority-high')) return 3;
  if (issue.labels.some(l => l.name === 'priority-medium')) return 2;
  if (issue.labels.some(l => l.name === 'priority-low')) return 1;
  return 0;
}
```

### 2.3 競合検知と実行グループ作成

Issue 間の競合を検出し、安全に並列実行できるグループを作成します。

#### なぜ競合検知が必要か

複数の Issue を並列処理すると効率的ですが、以下のような競合が発生する可能性があります：

1. **技術スタックの競合**: Next.js と Nuxt.js を同時に導入
2. **ファイル編集の競合**: 同じファイルを複数の Issue が変更
3. **依存関係の競合**: package.json を同時に変更
4. **設定ファイルの競合**: tsconfig.json などを同時に変更

#### 競合検知の実装

```typescript
async function detectConflictsAndGroup(
  issues: Issue[]
): Promise<IssueGroup[]> {
  const detector = new ConflictDetector();

  logger.info('Issue 間の競合を検知中...');

  // 各 Issue の影響範囲を分析
  const scopes = await Promise.all(
    issues.map(issue => detector.analyzeIssueScope(issue))
  );

  logger.debug('分析結果:', scopes.map(s => ({
    issue: s.issueNumber,
    techStack: Array.from(s.techStack),
    filePatterns: Array.from(s.filePatterns),
    dependencyChange: s.dependencyChange,
    configChange: s.configChange,
  })));

  // 競合を検出
  const conflicts = new Map<number, Set<number>>();

  for (let i = 0; i < scopes.length; i++) {
    for (let j = i + 1; j < scopes.length; j++) {
      if (detector.hasConflict(scopes[i], scopes[j])) {
        if (!conflicts.has(i)) conflicts.set(i, new Set());
        if (!conflicts.has(j)) conflicts.set(j, new Set());
        conflicts.get(i)!.add(j);
        conflicts.get(j)!.add(i);

        logger.warn(
          `競合検出: Issue #${issues[i].number} と Issue #${issues[j].number}`
        );
      }
    }
  }

  // 実行グループを作成
  const groups = detector.createExecutionGroups(issues, conflicts);

  logger.info(`実行グループ作成完了: ${groups.length}グループ`);
  groups.forEach((group, i) => {
    const issueNumbers = group.issues.map(issue => `#${issue.number}`).join(', ');
    logger.info(
      `  グループ ${i + 1}: ${group.parallel ? '並列' : '順次'} - ${issueNumbers}`
    );
  });

  return groups;
}
```

#### 競合検知の例

**ケース1: 技術スタックの競合**
```typescript
// Issue #100: "Add Next.js to the project"
// Issue #101: "Migrate to Nuxt.js"
// → 競合! 順次実行

const scope100 = {
  issueNumber: 100,
  techStack: new Set(['nextjs']),
  filePatterns: new Set(['next.config.js', 'pages/**/*']),
  dependencyChange: true,
  configChange: false,
};

const scope101 = {
  issueNumber: 101,
  techStack: new Set(['nuxtjs']),
  filePatterns: new Set(['nuxt.config.js', 'pages/**/*']),
  dependencyChange: true,
  configChange: false,
};

// hasConflict(scope100, scope101) → true
// 理由: Next.js と Nuxt.js は共存できない
```

**ケース2: ファイルの競合**
```typescript
// Issue #200: "Update Button component"
// Issue #201: "Refactor Button styles"
// → 競合! 順次実行

const scope200 = {
  issueNumber: 200,
  techStack: new Set(['react']),
  filePatterns: new Set(['src/components/Button.tsx']),
  dependencyChange: false,
  configChange: false,
};

const scope201 = {
  issueNumber: 201,
  techStack: new Set(['react']),
  filePatterns: new Set(['src/components/Button.tsx']),
  dependencyChange: false,
  configChange: false,
};

// hasConflict(scope200, scope201) → true
// 理由: 同じファイルを変更
```

**ケース3: 競合なし**
```typescript
// Issue #300: "Add Footer component"
// Issue #301: "Add Header component"
// → 競合なし! 並列実行可能

const scope300 = {
  issueNumber: 300,
  techStack: new Set(['react']),
  filePatterns: new Set(['src/components/Footer.tsx']),
  dependencyChange: false,
  configChange: false,
};

const scope301 = {
  issueNumber: 301,
  techStack: new Set(['react']),
  filePatterns: new Set(['src/components/Header.tsx']),
  dependencyChange: false,
  configChange: false,
};

// hasConflict(scope300, scope301) → false
// 理由: 異なるファイルを変更、技術スタックも共通
```

#### グループ実行戦略

```typescript
async function executeGroups(
  groups: IssueGroup[],
  context: Context
): Promise<void> {
  const { config } = context;

  for (const [index, group] of groups.entries()) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`グループ ${index + 1}/${groups.length} の実行`);
    logger.info(`実行モード: ${group.parallel ? '並列' : '順次'}`);
    logger.info(`Issue数: ${group.issues.length}`);
    logger.info(`${'='.repeat(60)}\n`);

    if (group.parallel && config.workflow.maxConcurrency > 1) {
      // 並列実行
      logger.info('並列実行開始...');

      const results = await Promise.allSettled(
        group.issues.map(issue => processIssue(issue, context))
      );

      // 結果を集計
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info(`並列実行完了: 成功 ${succeeded}件, 失敗 ${failed}件`);

    } else {
      // 順次実行
      logger.info('順次実行開始...');

      for (const issue of group.issues) {
        try {
          await processIssue(issue, context);
        } catch (error) {
          logger.error(`Issue #${issue.number} の処理に失敗:`, error);
          // 次の Issue に続行
        }
      }

      logger.info('順次実行完了');
    }
  }
}
```

#### メインフローでの使用

```typescript
async function run(
  context: Context,
  options: { issueNumber?: number }
): Promise<Report> {
  const { config, githubClient } = context;

  // 1. Issue 取得（一覧 or 単一）
  const issues = await fetchIssues(context, options);

  // 特定Issue指定の場合は、フィルタリングと競合検知をスキップ
  if (options.issueNumber) {
    logger.info(`特定Issue #${options.issueNumber} のみ処理します`);

    // 直接処理
    await processIssue(issues[0]!, context);

    return context.stats.generateReport();
  }

  // 2. フィルタリングとソート（通常モード）
  const filtered = filterAndSortIssues(issues, config);

  if (filtered.length === 0) {
    logger.info('処理対象の Issue がありません');
    return context.stats.generateReport();
  }

  // 3. 競合検知と実行グループ作成
  const groups = await detectConflictsAndGroup(filtered);

  // 4. グループごとに実行
  await executeGroups(groups, context);

  // 5. レポート生成
  return context.stats.generateReport();
}
```

**特定Issue指定時の動作**:
- ラベルチェックをスキップ（指定されたIssueを必ず処理）
- 競合検知をスキップ（単一Issueなので競合なし）
- 即座に処理開始

## 3. Issue処理ループ

### 3.1 処理前の準備

```typescript
async function processIssue(
  issue: Issue,
  context: Context
): Promise<ProcessResult> {
  const { config, githubClient, gitManager, claudeClient, stats } = context;

  const startTime = Date.now();
  const issueNumber = issue.number;

  logger.info(`\n${'='.repeat(60)}`);
  logger.info(`Issue #${issueNumber} の処理を開始`);
  logger.info(`タイトル: ${issue.title}`);
  logger.info(`${'='.repeat(60)}\n`);

  // 処理中ラベル追加
  await githubClient.addLabel(issueNumber, 'claude-processing');

  // Worktreeパスとブランチ名決定
  const worktreePath = path.join(
    config.git.worktreeDir,
    `issue-${issueNumber}`
  );
  const branchName = `${config.git.branchPrefix}${issueNumber}`;

  try {
    // Worktree作成
    await gitManager.createWorktree({
      branch: branchName,
      path: worktreePath,
      baseBranch: config.git.baseBranch,
    });

    logger.info(`Worktree作成完了: ${worktreePath}`);

    // 実装フェーズ
    const implementResult = await implementPhase(
      issue,
      worktreePath,
      context
    );

    // レビューフェーズ
    if (config.workflow.autoReview) {
      await reviewPhase(issue, worktreePath, context);
    }

    // テスト実行
    if (config.workflow.runTests) {
      await testPhase(worktreePath, context);
    }

    // コミット
    await commitPhase(issue, worktreePath, context);

    // Push
    if (config.workflow.autoPush) {
      await pushPhase(branchName, worktreePath, context);
    }

    // PR作成
    if (config.workflow.autoCreatePR) {
      await createPRPhase(issue, branchName, context);
    }

    // 成功ラベル
    await githubClient.removeLabel(issueNumber, 'claude-processing');
    await githubClient.addLabel(issueNumber, 'claude-completed');

    const duration = Date.now() - startTime;
    stats.recordSuccess(issueNumber, duration);

    logger.info(`\n✓ Issue #${issueNumber} の処理完了 (${duration}ms)\n`);

    return { success: true, issueNumber, duration };

  } catch (error) {
    // エラー処理
    return await handleError(error, issue, context, startTime);

  } finally {
    // Worktree削除
    try {
      await gitManager.removeWorktree(worktreePath);
      logger.info(`Worktree削除完了: ${worktreePath}`);
    } catch (error) {
      logger.error(`Worktree削除失敗: ${error.message}`);
    }
  }
}
```

### 3.2 実装フェーズ

```typescript
async function implementPhase(
  issue: Issue,
  worktreePath: string,
  context: Context
): Promise<ImplementResult> {
  const { claudeClient, config } = context;

  logger.info('実装フェーズ開始');

  // Issueの内容を整形
  const prompt = buildImplementPrompt(issue, worktreePath);

  // Claudeに実装依頼
  const result = await claudeClient.implement({
    prompt,
    worktreePath,
    model: config.claude.model,
    temperature: config.claude.temperature,
    maxTokens: config.claude.maxTokens,
  });

  logger.info('実装フェーズ完了', {
    filesChanged: result.filesChanged,
    tokensUsed: result.tokensUsed,
  });

  return result;
}

function buildImplementPrompt(issue: Issue, worktreePath: string): string {
  return `
あなたは優秀なソフトウェアエンジニアです。
以下のGitHub Issueを実装してください。

# Issue情報
- Issue番号: #${issue.number}
- タイトル: ${issue.title}
- 本文:
${issue.body}

# 作業ディレクトリ
${worktreePath}

# 実装要件
1. 既存のコードスタイルとアーキテクチャに従ってください
2. 必要に応じてテストを追加してください
3. エッジケースを考慮してください
4. セキュリティに注意してください
5. パフォーマンスを考慮してください

# 成果物
- 実装に必要なファイルの変更
- テストコード（必要な場合）
- コメント（複雑なロジックの場合）

実装を開始してください。
`.trim();
}
```

### 3.3 レビューフェーズ

```typescript
async function reviewPhase(
  issue: Issue,
  worktreePath: string,
  context: Context
): Promise<void> {
  const { claudeClient, gitManager, config } = context;
  const maxIterations = config.workflow.reviewIterations;

  logger.info('レビューフェーズ開始');

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    logger.info(`レビュー ${iteration}/${maxIterations} 回目`);

    // 変更差分を取得
    const diff = await gitManager.getDiff(worktreePath);

    if (!diff) {
      logger.warn('変更が検出されませんでした');
      break;
    }

    // Claudeにレビュー依頼
    const reviewResult = await claudeClient.review({
      diff,
      issue,
      worktreePath,
    });

    logger.info('レビュー結果:', {
      issuesFound: reviewResult.issues.length,
      suggestions: reviewResult.suggestions.length,
    });

    // 問題がなければ終了
    if (reviewResult.issues.length === 0) {
      logger.info('✓ レビュー完了: 問題なし');
      break;
    }

    // 最後のイテレーションでは修正しない
    if (iteration === maxIterations) {
      logger.warn('最大レビュー回数に達しました。以下の問題が残っています:');
      reviewResult.issues.forEach((issue, i) => {
        logger.warn(`  ${i + 1}. ${issue}`);
      });
      break;
    }

    // 問題を修正
    logger.info('問題点を修正中...');
    await claudeClient.implementFixes({
      issues: reviewResult.issues,
      suggestions: reviewResult.suggestions,
      worktreePath,
    });

    // 変更をステージング
    await gitManager.stageAll(worktreePath);
  }

  logger.info('レビューフェーズ完了');
}
```

### 3.4 テストフェーズ

```typescript
async function testPhase(
  worktreePath: string,
  context: Context
): Promise<void> {
  const { config } = context;

  logger.info('テストフェーズ開始');

  try {
    // ビルド（必要な場合）
    if (config.workflow.buildBeforeTest) {
      logger.info('ビルド実行中...');
      await execInWorktree(
        worktreePath,
        config.workflow.buildCommand
      );
      logger.info('✓ ビルド成功');
    }

    // テスト実行
    logger.info('テスト実行中...');
    const testResult = await execInWorktree(
      worktreePath,
      config.workflow.testCommand
    );

    logger.info('✓ テスト成功');
    logger.debug('テスト結果:', testResult);

  } catch (error) {
    logger.error('✗ テスト失敗');
    throw new TestFailureError(
      `テストが失敗しました: ${error.message}`,
      error.stdout,
      error.stderr
    );
  }
}

async function execInWorktree(
  worktreePath: string,
  command: string
): Promise<ExecResult> {
  const { stdout, stderr } = await exec(command, {
    cwd: worktreePath,
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });

  return { stdout, stderr };
}
```

### 3.5 コミットフェーズ

```typescript
async function commitPhase(
  issue: Issue,
  worktreePath: string,
  context: Context
): Promise<void> {
  const { gitManager, config } = context;

  logger.info('コミットフェーズ開始');

  // 変更があるか確認
  const hasChanges = await gitManager.hasChanges(worktreePath);
  if (!hasChanges) {
    throw new Error('コミットする変更がありません');
  }

  // コミットメッセージ生成
  const message = buildCommitMessage(issue, config);

  // ステージングとコミット
  await gitManager.stageAll(worktreePath);
  await gitManager.commit(worktreePath, message);

  logger.info('✓ コミット完了');
}

function buildCommitMessage(issue: Issue, config: Config): string {
  const template = config.git.commitMessageTemplate;

  // テンプレート変数を展開
  return template
    .replace(/\{\{issue_number\}\}/g, issue.number.toString())
    .replace(/\{\{issue_title\}\}/g, issue.title)
    .replace(/\{\{issue_body\}\}/g, truncate(issue.body, 200));
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
```

### 3.6 Pushフェーズ

```typescript
async function pushPhase(
  branchName: string,
  worktreePath: string,
  context: Context
): Promise<void> {
  const { gitManager } = context;

  logger.info('Pushフェーズ開始');

  try {
    await gitManager.push(worktreePath, 'origin', branchName);
    logger.info(`✓ Push完了: origin/${branchName}`);
  } catch (error) {
    if (error.message.includes('remote contains work')) {
      logger.warn('リモートブランチが既に存在します。force pushを試みます...');
      await gitManager.push(worktreePath, 'origin', branchName, { force: true });
      logger.info('✓ Force push完了');
    } else {
      throw error;
    }
  }
}
```

### 3.7 PR作成フェーズ

```typescript
async function createPRPhase(
  issue: Issue,
  branchName: string,
  context: Context
): Promise<PullRequest> {
  const { githubClient, gitManager, config } = context;

  logger.info('PR作成フェーズ開始');

  // PR本文生成
  const body = buildPRBody(issue, gitManager);

  // PR作成
  const pr = await githubClient.createPR({
    owner: config.github.owner,
    repo: config.github.repo,
    title: `Fix #${issue.number}: ${issue.title}`,
    body,
    base: config.git.baseBranch,
    head: branchName,
  });

  logger.info(`✓ PR作成完了: ${pr.html_url}`);

  // Issueにコメント
  await githubClient.addComment(
    issue.number,
    `🤖 プルリクエストを作成しました: ${pr.html_url}`
  );

  return pr;
}

function buildPRBody(issue: Issue, gitManager: GitManager): string {
  return `
## 概要
Closes #${issue.number}

${issue.body}

## 実装内容
Claude による自動実装とレビューが完了しました。

## テスト
- [x] 自動テスト実行済み
- [ ] 手動テスト（レビュアーによる確認）

## チェックリスト
- [x] コードが既存のスタイルに従っている
- [x] テストが追加されている（必要な場合）
- [x] ドキュメントが更新されている（必要な場合）

---
🤖 Generated by [Claude Runner](https://github.com/your-org/claude-runner)
`.trim();
}
```

## 4. エラーハンドリング

### 4.1 エラー分類

```typescript
class ErrorHandler {
  async handle(
    error: Error,
    issue: Issue,
    context: Context,
    startTime: number
  ): Promise<ProcessResult> {
    const { githubClient, stats } = context;
    const duration = Date.now() - startTime;

    // エラー分類
    const errorType = this.classifyError(error);

    logger.error(`Error type: ${errorType}`, { error });

    // Issueにコメント
    await this.commentOnIssue(issue.number, error, errorType, githubClient);

    // ラベル更新
    await githubClient.removeLabel(issue.number, 'claude-processing');
    await githubClient.addLabel(issue.number, 'claude-failed');
    await githubClient.addLabel(issue.number, `error:${errorType}`);

    // 統計記録
    stats.recordFailure(issue.number, errorType, duration);

    // 通知送信
    await this.sendNotification(issue, error, errorType, context);

    return {
      success: false,
      issueNumber: issue.number,
      error: error.message,
      errorType,
      duration,
    };
  }

  classifyError(error: Error): ErrorType {
    if (error instanceof TestFailureError) return 'test-failure';
    if (error instanceof BuildError) return 'build-error';
    if (error instanceof GitError) return 'git-error';
    if (error instanceof ClaudeAPIError) return 'claude-api-error';
    if (error instanceof GitHubAPIError) return 'github-api-error';
    if (error.message.includes('timeout')) return 'timeout';
    return 'unknown';
  }

  async commentOnIssue(
    issueNumber: number,
    error: Error,
    errorType: ErrorType,
    githubClient: GitHubClient
  ): Promise<void> {
    const comment = `
⚠️ 自動実装中にエラーが発生しました

**エラータイプ**: \`${errorType}\`

**エラーメッセージ**:
\`\`\`
${error.message}
\`\`\`

${this.getErrorSuggestion(errorType)}

---
このIssueには \`claude-failed\` ラベルが付与されました。
問題を解決後、ラベルを削除して再実行してください。
`.trim();

    await githubClient.addComment(issueNumber, comment);
  }

  getErrorSuggestion(errorType: ErrorType): string {
    const suggestions = {
      'test-failure': '**対応**: テストが失敗しました。Issueの要件を見直すか、テストを修正してください。',
      'build-error': '**対応**: ビルドエラーが発生しました。依存関係や設定を確認してください。',
      'git-error': '**対応**: Git操作でエラーが発生しました。ブランチやコンフリクトを確認してください。',
      'claude-api-error': '**対応**: Claude APIでエラーが発生しました。レート制限やAPIキーを確認してください。',
      'github-api-error': '**対応**: GitHub APIでエラーが発生しました。トークンや権限を確認してください。',
      'timeout': '**対応**: タイムアウトが発生しました。Issueの複雑さを見直すか、タイムアウト時間を延ばしてください。',
      'unknown': '**対応**: 予期しないエラーが発生しました。ログを確認してください。',
    };

    return suggestions[errorType] || suggestions['unknown'];
  }
}
```

## 5. 統計とレポート

### 5.1 統計収集

```typescript
class Statistics {
  private results: ProcessResult[] = [];
  private startTime: number = Date.now();

  recordSuccess(issueNumber: number, duration: number): void {
    this.results.push({
      success: true,
      issueNumber,
      duration,
    });
  }

  recordFailure(
    issueNumber: number,
    errorType: ErrorType,
    duration: number
  ): void {
    this.results.push({
      success: false,
      issueNumber,
      errorType,
      duration,
    });
  }

  generateReport(): Report {
    const totalTime = Date.now() - this.startTime;
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    return {
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / this.results.length) * 100,
      averageTime: successful.reduce((sum, r) => sum + r.duration, 0) / successful.length,
      totalTime,
      results: this.results,
    };
  }
}
```

### 5.2 レポート出力

```typescript
function printReport(report: Report): void {
  console.log('\n' + '='.repeat(60));
  console.log('Claude Runner - 実行レポート');
  console.log('='.repeat(60));
  console.log();
  console.log(`総実行時間: ${formatDuration(report.totalTime)}`);
  console.log(`処理件数: ${report.total}`);
  console.log(`成功: ${report.successful} (${report.successRate.toFixed(1)}%)`);
  console.log(`失敗: ${report.failed}`);
  console.log(`平均処理時間: ${formatDuration(report.averageTime)}`);
  console.log();

  if (report.failed > 0) {
    console.log('失敗したIssue:');
    report.results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - Issue #${r.issueNumber}: ${r.errorType}`);
      });
    console.log();
  }

  console.log('='.repeat(60));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}時間${minutes % 60}分${seconds % 60}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  }
  return `${seconds}秒`;
}
```

## 6. 通知システム

### 6.1 Slack通知

```typescript
async function sendSlackNotification(
  issue: Issue,
  result: ProcessResult,
  config: Config
): Promise<void> {
  if (!config.notification?.enabled) return;

  const slack = config.notification.slack;
  if (!slack?.webhookUrl) return;

  // 成功時の通知を無効にしている場合はスキップ
  if (result.success && !slack.onSuccess) return;
  if (!result.success && !slack.onFailure) return;

  const message = result.success
    ? buildSuccessMessage(issue, result)
    : buildFailureMessage(issue, result);

  await fetch(slack.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
}

function buildSuccessMessage(issue: Issue, result: ProcessResult) {
  return {
    text: `✅ Issue #${issue.number} の実装が完了しました`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*✅ Issue #${issue.number} 実装完了*\n${issue.title}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*処理時間*\n${formatDuration(result.duration)}`,
          },
          {
            type: 'mrkdwn',
            text: `*PR*\n<${result.prUrl}|View PR>`,
          },
        ],
      },
    ],
  };
}
```

## まとめ

このワークフローにより、GitHub Issueの自動実装から PR作成まで、人間の介入を最小限にしたエンドツーエンドの自動化が実現できます。各フェーズでのエラーハンドリングとロギングにより、問題の特定と修正も容易になります。
