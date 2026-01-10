# 実装計画

## 開発フェーズ

全体を5つのフェーズに分けて段階的に実装します。各フェーズで動作確認を行い、次のフェーズに進みます。

## フェーズ 0: プロジェクト初期化（30分）

### 目的
プロジェクトの基本構造とツールチェーンをセットアップする

### タスク

1. **プロジェクト初期化**
   ```bash
   npm init -y
   npm install -D typescript tsx @types/node
   npm install -D eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
   npx tsc --init
   ```

2. **ディレクトリ構造作成**
   ```bash
   mkdir -p src/{types,config,github,git,claude,orchestrator,utils}
   mkdir -p logs
   ```

3. **設定ファイル作成**
   - `tsconfig.json`
   - `.eslintrc.json`
   - `.prettierrc`
   - `.gitignore`
   - `config.example.yaml`

4. **package.json のスクリプト設定**
   ```json
   {
     "scripts": {
       "dev": "tsx src/index.ts",
       "build": "tsc",
       "start": "node dist/index.js",
       "lint": "eslint src --ext .ts",
       "format": "prettier --write 'src/**/*.ts'"
     }
   }
   ```

### 成果物
- 動作する TypeScript 環境
- 基本的なディレクトリ構造

### 検証方法
```bash
npm run dev  # Hello World が表示される
npm run lint # エラーなし
npm run build # dist/ にJSファイルが生成される
```

---

## フェーズ 1: 基本構造（2-3時間）

### 目的
設定ファイル読み込みと GitHub Issue 取得の基本機能を実装する

### タスク

#### 1.1 依存関係インストール
```bash
npm install @octokit/rest yaml zod winston
npm install -D @types/node
```

#### 1.2 型定義の作成
**ファイル**: `src/types/config.ts`
```typescript
export interface Config {
  github: GitHubConfig;
  git: GitConfig;
  claude: ClaudeConfig;
  workflow: WorkflowConfig;
  logging?: LoggingConfig;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  labels: string[];
  excludeLabels?: string[];
}

// ... 他の型定義
```

**ファイル**: `src/types/github.ts`
```typescript
export interface Issue {
  number: number;
  title: string;
  body: string;
  labels: Label[];
  assignee: User | null;
  created_at: string;
  updated_at: string;
}

// ... 他の型定義
```

#### 1.3 設定ローダーの実装
**ファイル**: `src/config/loader.ts`
- YAML パース
- 環境変数展開
- Zod バリデーション

#### 1.4 ロガーの実装
**ファイル**: `src/utils/logger.ts`
- Winston でのロガー設定
- コンソールとファイル出力

#### 1.5 GitHub クライアントの実装
**ファイル**: `src/github/client.ts`
- Octokit 初期化
- `getIssues()` メソッド
- レート制限ハンドリング

#### 1.6 エントリーポイント
**ファイル**: `src/index.ts`
```typescript
async function main() {
  // 設定読み込み
  const config = await loadConfig();

  // GitHub クライアント初期化
  const github = new GitHubClient(config.github);

  // Issue 取得
  const issues = await github.getIssues();

  console.log(`取得したIssue: ${issues.length}件`);
  issues.forEach(issue => {
    console.log(`#${issue.number}: ${issue.title}`);
  });
}

main().catch(console.error);
```

### 成果物
- 設定ファイルから GitHub Token を読み込める
- GitHub API で Issue 一覧を取得できる
- ログがコンソールとファイルに出力される

### 検証方法
1. `config.yaml` を作成（GitHub Token を設定）
2. `npm run dev` を実行
3. Issue 一覧が表示される
4. `logs/` にログファイルが作成される

---

## フェーズ 2: Git 操作（2-3時間）

### 目的
Git worktree の作成・削除とブランチ管理を実装する

### タスク

#### 2.1 Git Manager の実装
**ファイル**: `src/git/worktree.ts`

主要メソッド:
```typescript
class GitManager {
  async createWorktree(options: {
    branch: string;
    path: string;
    baseBranch: string;
  }): Promise<void>

  async removeWorktree(path: string): Promise<void>

  async hasChanges(path: string): Promise<boolean>

  async getDiff(path: string): Promise<string>

  async stageAll(path: string): Promise<void>

  async commit(path: string, message: string): Promise<void>

  async push(
    path: string,
    remote: string,
    branch: string,
    options?: { force?: boolean }
  ): Promise<void>
}
```

#### 2.2 実装のポイント

**Worktree 作成**:
```typescript
async createWorktree(options: CreateWorktreeOptions): Promise<void> {
  const { branch, path, baseBranch } = options;

  // ディレクトリが既に存在する場合は削除
  if (await exists(path)) {
    await this.removeWorktree(path);
  }

  // Worktree 作成
  await exec(`git worktree add "${path}" -b "${branch}" "${baseBranch}"`);

  logger.info(`Worktree created: ${path}`);
}
```

**Diff 取得**:
```typescript
async getDiff(path: string): Promise<string> {
  const { stdout } = await exec('git diff HEAD', { cwd: path });
  return stdout;
}
```

#### 2.3 テスト用スクリプト
**ファイル**: `src/test-git.ts`
```typescript
async function testGit() {
  const gitManager = new GitManager(config.git);

  // Worktree 作成
  await gitManager.createWorktree({
    branch: 'test/worktree',
    path: '.worktrees/test',
    baseBranch: 'main',
  });

  // ファイル変更
  await fs.writeFile('.worktrees/test/test.txt', 'Hello World');

  // Diff 確認
  const diff = await gitManager.getDiff('.worktrees/test');
  console.log('Diff:', diff);

  // コミット
  await gitManager.stageAll('.worktrees/test');
  await gitManager.commit('.worktrees/test', 'Test commit');

  // Worktree 削除
  await gitManager.removeWorktree('.worktrees/test');
}
```

### 成果物
- Worktree を作成・削除できる
- 変更を検出し diff を取得できる
- コミットとプッシュができる

### 検証方法
1. `npm run test:git` を実行
2. `.worktrees/test/` が作成される
3. 変更をコミット
4. Worktree が削除される

---

## フェーズ 3: Claude 統合（3-4時間）

### 目的
Anthropic API を使って Issue の実装とレビューを行う

### タスク

#### 3.1 依存関係インストール
```bash
npm install @anthropic-ai/sdk
```

#### 3.2 Claude Client の実装
**ファイル**: `src/claude/client.ts`

```typescript
class ClaudeClient {
  private anthropic: Anthropic;

  constructor(config: ClaudeConfig) {
    this.anthropic = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
  }

  async sendMessage(prompt: string): Promise<string> {
    const message = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // テキストコンテンツを抽出
    const textContent = message.content.find(
      block => block.type === 'text'
    );

    return textContent ? textContent.text : '';
  }
}
```

#### 3.3 Implementer の実装
**ファイル**: `src/claude/implementer.ts`

```typescript
class Implementer {
  constructor(
    private claudeClient: ClaudeClient,
    private gitManager: GitManager
  ) {}

  async implement(
    issue: Issue,
    worktreePath: string
  ): Promise<ImplementResult> {
    // プロンプト生成
    const prompt = this.buildPrompt(issue, worktreePath);

    // Claude に送信
    const response = await this.claudeClient.sendMessage(prompt);

    // レスポンスをパース（ファイル変更の指示を抽出）
    const changes = this.parseResponse(response);

    // ファイルを実際に変更
    await this.applyChanges(changes, worktreePath);

    return {
      filesChanged: changes.length,
      changes,
    };
  }

  private buildPrompt(issue: Issue, worktreePath: string): string {
    // コードベースの構造を読み込む
    const structure = this.readProjectStructure(worktreePath);

    return `
あなたは優秀なソフトウェアエンジニアです。
以下のGitHub Issueを実装してください。

# Issue情報
Issue #${issue.number}: ${issue.title}

${issue.body}

# プロジェクト構造
${structure}

# 実装要件
- 既存のコードスタイルに従う
- 必要に応じてテストを追加
- セキュリティに注意

実装してください。変更するファイルとその内容を明確に示してください。
`.trim();
  }

  private parseResponse(response: string): FileChange[] {
    // レスポンスから変更情報を抽出
    // 例: "ファイル: src/foo.ts" のようなパターンを探す
    // この部分は Claude の出力形式に依存する
    // ...
  }

  private async applyChanges(
    changes: FileChange[],
    worktreePath: string
  ): Promise<void> {
    for (const change of changes) {
      const filePath = path.join(worktreePath, change.path);

      if (change.type === 'create' || change.type === 'update') {
        await fs.writeFile(filePath, change.content);
      } else if (change.type === 'delete') {
        await fs.unlink(filePath);
      }
    }
  }
}
```

#### 3.4 Reviewer の実装
**ファイル**: `src/claude/reviewer.ts`

```typescript
class Reviewer {
  constructor(private claudeClient: ClaudeClient) {}

  async review(
    diff: string,
    issue: Issue
  ): Promise<ReviewResult> {
    const prompt = `
以下の実装をレビューしてください。

# 元のIssue
${issue.title}

${issue.body}

# 実装された変更
\`\`\`diff
${diff}
\`\`\`

# レビュー観点
- 要件を満たしているか
- コードの品質
- セキュリティ
- テストの妥当性

問題点と改善提案を箇条書きで挙げてください。
`.trim();

    const response = await this.claudeClient.sendMessage(prompt);

    // レスポンスをパース
    const issues = this.parseIssues(response);
    const suggestions = this.parseSuggestions(response);

    return {
      hasIssues: issues.length > 0,
      issues,
      suggestions,
    };
  }
}
```

### 成果物
- Claude API と通信できる
- Issue を元に実装を生成できる
- Diff をレビューできる

### 検証方法
1. 簡単な Issue を用意（例: "Add a hello world function"）
2. `npm run test:claude` を実行
3. ファイルが生成される
4. レビュー結果が表示される

---

## フェーズ 4: オーケストレーション（2-3時間）

### 目的
すべての機能を統合し、エンドツーエンドのワークフローを実現する

### タスク

#### 4.1 Orchestrator の実装
**ファイル**: `src/orchestrator/index.ts`

```typescript
export class Orchestrator {
  constructor(private context: Context) {}

  async run(): Promise<Report> {
    const { config, githubClient } = this.context;

    // Issue 取得
    const issues = await githubClient.getIssues();
    const filtered = filterAndSortIssues(issues, config);

    logger.info(`処理対象: ${filtered.length}件`);

    // 各 Issue を処理
    for (const issue of filtered) {
      try {
        await this.processIssue(issue);
      } catch (error) {
        await this.handleError(error, issue);
      }
    }

    // レポート生成
    return this.context.stats.generateReport();
  }

  private async processIssue(issue: Issue): Promise<void> {
    const { config, gitManager, claudeClient, githubClient } = this.context;

    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`Issue #${issue.number}: ${issue.title}`);
    logger.info(`${'='.repeat(60)}\n`);

    // 処理中ラベル
    await githubClient.addLabel(issue.number, 'claude-processing');

    // Worktree 作成
    const worktreePath = path.join(
      config.git.worktreeDir,
      `issue-${issue.number}`
    );
    const branchName = `${config.git.branchPrefix}${issue.number}`;

    try {
      await gitManager.createWorktree({
        branch: branchName,
        path: worktreePath,
        baseBranch: config.git.baseBranch,
      });

      // 実装
      await claudeClient.implement(issue, worktreePath);

      // レビュー
      if (config.workflow.autoReview) {
        await this.reviewLoop(issue, worktreePath);
      }

      // テスト
      if (config.workflow.runTests) {
        await this.runTests(worktreePath);
      }

      // コミット
      await this.commit(issue, worktreePath);

      // Push
      if (config.workflow.autoPush) {
        await gitManager.push(worktreePath, 'origin', branchName);
      }

      // PR 作成
      if (config.workflow.autoCreatePR) {
        await this.createPR(issue, branchName);
      }

      // 成功ラベル
      await githubClient.removeLabel(issue.number, 'claude-processing');
      await githubClient.addLabel(issue.number, 'claude-completed');

      logger.info(`✓ Issue #${issue.number} 完了`);

    } finally {
      // Worktree 削除
      await gitManager.removeWorktree(worktreePath);
    }
  }
}
```

#### 4.2 メインエントリーポイント更新
**ファイル**: `src/index.ts`

```typescript
async function main() {
  // 設定読み込み
  const config = await loadConfig();

  // ロガー初期化
  initLogger(config.logging);

  // コンテキスト作成
  const context: Context = {
    config,
    githubClient: new GitHubClient(config.github),
    claudeClient: new ClaudeClient(config.claude),
    gitManager: new GitManager(config.git),
    stats: new Statistics(),
  };

  // Orchestrator 実行
  const orchestrator = new Orchestrator(context);
  const report = await orchestrator.run();

  // レポート出力
  printReport(report);

  // 通知送信
  if (config.notification?.enabled) {
    await sendNotification(report, config);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

#### 4.3 競合検知機能の追加
**ファイル**: `src/orchestrator/conflict-detector.ts`

並列処理時の Issue 間の競合を検知する機能を実装します。

```typescript
export class ConflictDetector {
  /**
   * Issue の影響範囲を分析
   */
  async analyzeIssueScope(issue: Issue): Promise<IssueScope> {
    const text = `${issue.title} ${issue.body}`.toLowerCase();

    return {
      issueNumber: issue.number,
      techStack: this.detectTechStack(text),
      filePatterns: this.estimateFilePatterns(text),
      dependencyChange: this.hasDependencyChange(text),
      configChange: this.hasConfigChange(text),
    };
  }

  /**
   * 技術スタックを検出
   */
  private detectTechStack(text: string): Set<string> {
    const stacks = new Set<string>();
    const patterns = {
      'nextjs': /next\.?js|next\.config/i,
      'nuxtjs': /nuxt\.?js|nuxt\.config/i,
      'react': /\breact\b/i,
      'vue': /\bvue\b/i,
      'angular': /\bangular\b/i,
    };

    for (const [stack, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) stacks.add(stack);
    }

    return stacks;
  }

  /**
   * 2つの Issue が競合するかチェック
   */
  hasConflict(scope1: IssueScope, scope2: IssueScope): boolean {
    // 技術スタックの競合（Next.js と Nuxt.js など）
    const conflictingStacks = [
      ['nextjs', 'nuxtjs'],
      ['react', 'vue'],
      ['react', 'angular'],
    ];

    for (const [stack1, stack2] of conflictingStacks) {
      if (
        (scope1.techStack.has(stack1) && scope2.techStack.has(stack2)) ||
        (scope1.techStack.has(stack2) && scope2.techStack.has(stack1))
      ) {
        return true;
      }
    }

    // ファイルパターンの重複
    for (const p1 of scope1.filePatterns) {
      for (const p2 of scope2.filePatterns) {
        if (this.patternsOverlap(p1, p2)) return true;
      }
    }

    // 依存関係や設定ファイルの同時変更
    if (scope1.dependencyChange && scope2.dependencyChange) return true;
    if (scope1.configChange && scope2.configChange) return true;

    return false;
  }

  /**
   * 競合グラフから実行グループを作成
   */
  createExecutionGroups(
    issues: Issue[],
    conflicts: Map<number, Set<number>>
  ): IssueGroup[] {
    const groups: IssueGroup[] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < issues.length; i++) {
      if (assigned.has(i)) continue;

      if (!conflicts.has(i)) {
        // 競合なし → 並列グループに追加可能
        let added = false;
        for (const group of groups) {
          if (group.parallel && this.canAddToGroup(i, group, conflicts)) {
            group.issues.push(issues[i]);
            assigned.add(i);
            added = true;
            break;
          }
        }

        if (!added) {
          groups.push({ parallel: true, issues: [issues[i]] });
          assigned.add(i);
        }
      } else {
        // 競合あり → 順次実行
        groups.push({ parallel: false, issues: [issues[i]] });
        assigned.add(i);
      }
    }

    return groups;
  }
}
```

#### 4.4 Orchestrator の更新

競合検知を組み込んだワークフローに更新します。

```typescript
export class Orchestrator {
  async run(): Promise<Report> {
    const { config, githubClient } = this.context;

    // Issue 取得
    const issues = await githubClient.getIssues();
    const filtered = filterAndSortIssues(issues, config);

    if (filtered.length === 0) {
      logger.info('処理対象の Issue がありません');
      return this.context.stats.generateReport();
    }

    // 競合検知
    const detector = new ConflictDetector();
    const groups = await this.detectConflicts(filtered, detector);

    // グループごとに実行
    await this.executeGroups(groups);

    return this.context.stats.generateReport();
  }

  private async detectConflicts(
    issues: Issue[],
    detector: ConflictDetector
  ): Promise<IssueGroup[]> {
    logger.info('Issue 間の競合を検知中...');

    const scopes = await Promise.all(
      issues.map(issue => detector.analyzeIssueScope(issue))
    );

    const conflicts = new Map<number, Set<number>>();

    for (let i = 0; i < scopes.length; i++) {
      for (let j = i + 1; j < scopes.length; j++) {
        if (detector.hasConflict(scopes[i], scopes[j])) {
          if (!conflicts.has(i)) conflicts.set(i, new Set());
          if (!conflicts.has(j)) conflicts.set(j, new Set());
          conflicts.get(i)!.add(j);
          conflicts.get(j)!.add(i);

          logger.warn(
            `競合検出: Issue #${issues[i].number} ⚔️  Issue #${issues[j].number}`
          );
        }
      }
    }

    const groups = detector.createExecutionGroups(issues, conflicts);

    logger.info(`実行グループ: ${groups.length}個`);
    groups.forEach((group, i) => {
      const nums = group.issues.map(issue => `#${issue.number}`).join(', ');
      logger.info(`  グループ ${i + 1}: ${group.parallel ? '並列' : '順次'} - ${nums}`);
    });

    return groups;
  }

  private async executeGroups(groups: IssueGroup[]): Promise<void> {
    const { config } = this.context;

    for (const [index, group] of groups.entries()) {
      logger.info(`\nグループ ${index + 1}/${groups.length} の実行`);

      if (group.parallel && config.workflow.maxConcurrency > 1) {
        // 並列実行
        await Promise.allSettled(
          group.issues.map(issue => this.processIssue(issue))
        );
      } else {
        // 順次実行
        for (const issue of group.issues) {
          try {
            await this.processIssue(issue);
          } catch (error) {
            logger.error(`Issue #${issue.number} 失敗:`, error);
          }
        }
      }
    }
  }
}
```

### 成果物
- すべての機能が統合されている
- Issue 間の競合を検知して適切に並列/順次実行できる
- Issue → 実装 → レビュー → PR の流れが動作する

### 検証方法

**テストケース 1: 競合なし（並列実行）**
1. GitHub に以下の Issue を作成:
   - Issue #1: "Add Footer component"
   - Issue #2: "Add Header component"
2. `npm run dev` を実行
3. ログで「並列実行」と表示される
4. 両方の PR が作成される

**テストケース 2: 技術スタック競合（順次実行）**
1. GitHub に以下の Issue を作成:
   - Issue #3: "Add Next.js to the project"
   - Issue #4: "Add Nuxt.js to the project"
2. `npm run dev` を実行
3. ログで「競合検出」と警告が表示される
4. 順次実行される

**テストケース 3: ファイル競合（順次実行）**
1. GitHub に以下の Issue を作成:
   - Issue #5: "Update Button component style"
   - Issue #6: "Refactor Button component logic"
2. `npm run dev` を実行
3. ログで「競合検出」と警告が表示される
4. 順次実行される

---

## フェーズ 5: エラーハンドリングと仕上げ（2-3時間）

### 目的
本番運用に耐えられるようにエラーハンドリングと運用機能を追加する

### タスク

#### 5.1 エラーハンドリングの強化
**ファイル**: `src/utils/error.ts`

```typescript
export class ErrorHandler {
  async handle(
    error: Error,
    context: ErrorContext
  ): Promise<HandleResult> {
    const errorType = this.classifyError(error);

    // ログ記録
    logger.error('Error occurred', {
      errorType,
      message: error.message,
      stack: error.stack,
      context,
    });

    // GitHub にコメント
    await this.commentOnIssue(error, errorType, context);

    // ラベル追加
    await this.addErrorLabel(errorType, context);

    // リトライ判定
    if (this.isRetryable(error) && context.retryCount < 3) {
      logger.info('Retrying...');
      return { retry: true };
    }

    return { retry: false };
  }
}
```

#### 5.2 CLI 引数の追加
**ファイル**: `src/cli.ts`

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('claude-runner')
  .description('GitHub Issue の自動実装ツール')
  .version('1.0.0');

program
  .option('-c, --config <path>', '設定ファイルのパス', 'config.yaml')
  .option('-i, --issue <number>', '特定の Issue のみ処理')
  .option('--dry-run', 'Dry run モード（実際の変更なし）')
  .option('--no-push', 'Push を無効化')
  .option('--no-pr', 'PR 作成を無効化')
  .option('-v, --verbose', '詳細ログ')
  .action(async (options) => {
    await main(options);
  });

program.parse();
```

#### 5.3 統計レポートの強化

```typescript
class Statistics {
  // ... 既存のコード

  async saveReport(report: Report): Promise<void> {
    const filename = `logs/report-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    logger.info(`Report saved: ${filename}`);
  }

  printSummary(report: Report): void {
    console.log('\n' + '='.repeat(60));
    console.log('実行サマリー');
    console.log('='.repeat(60));
    console.log(`総処理時間: ${formatDuration(report.totalTime)}`);
    console.log(`処理件数: ${report.total}`);
    console.log(`成功: ${report.successful} (${report.successRate.toFixed(1)}%)`);
    console.log(`失敗: ${report.failed}`);

    if (report.failed > 0) {
      console.log('\n失敗した Issue:');
      report.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  #${r.issueNumber}: ${r.errorType}`);
        });
    }

    console.log('='.repeat(60) + '\n');
  }
}
```

#### 5.4 ドキュメント整備

- `README.md`: 使い方とクイックスタート
- `CONTRIBUTING.md`: 開発への参加方法
- `CHANGELOG.md`: 変更履歴

#### 5.5 CI/CD セットアップ

**.github/workflows/ci.yml**:
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

### 成果物
- 堅牢なエラーハンドリング
- CLI オプション
- 詳細なログと統計
- ドキュメント完備

---

## 推奨開発順序

1. **フェーズ 0** → 環境構築
2. **フェーズ 1** → 基本機能（設定、GitHub）
3. **フェーズ 2** → Git 操作
4. **フェーズ 3** → Claude 統合（最も時間がかかる）
5. **フェーズ 4** → オーケストレーション
6. **フェーズ 5** → 仕上げ

## 全体の見積もり

- **最小構成（フェーズ 0-4）**: 8-12時間
- **完全版（全フェーズ）**: 12-16時間

## 開発時の注意点

### 1. セキュリティ
- トークンを `.env` で管理
- `config.yaml` を `.gitignore` に追加
- GitHub Token のスコープを最小限に

### 2. コスト管理
- Claude API の使用量をモニタリング
- レート制限に注意
- テスト時は `claude-3-5-haiku` を使用

### 3. テスト戦略
- まず簡単な Issue でテスト
- Dry run モードで動作確認
- 本番実行前に人間のレビュー

### 4. 段階的リリース
- まず自分のプロジェクトで試す
- 成功したらチームに共有
- フィードバックを集めて改善

## 拡張案（将来的に）

1. **複数リポジトリ対応**
   - config に複数のリポジトリを設定可能に

2. **Webhook 対応**
   - Issue 作成時に自動実行

3. **Web UI**
   - 進捗確認や設定変更をブラウザで

4. **プラグインシステム**
   - カスタムプロンプトや処理フックを追加可能に

5. **メトリクスダッシュボード**
   - 成功率、処理時間などを可視化

---

これで実装計画は完成です。フェーズ 0 からスタートして、段階的に機能を追加していきましょう！
