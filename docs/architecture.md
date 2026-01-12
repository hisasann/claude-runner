# Claude Runner - アーキテクチャ設計書

## 概要

GitHub Issue を自動的に取得し、Claude Code を使って実装、レビュー、PR作成までを自動化するツール。

## 目的

- 特定のラベルが付いた GitHub Issue を自動実装
- Claude によるコードレビューとフィードバックループ
- PR 作成までの自動化（push は手動確認可能）
- ローカル環境で完結

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                      Claude Runner                          │
│                                                             │
│  ┌─────────────┐         ┌──────────────┐                 │
│  │ Config      │────────>│ Orchestrator │                 │
│  │ (YAML)      │         └──────┬───────┘                 │
│  └─────────────┘                │                          │
│                                  │                          │
│         ┌────────────────────────┼────────────────┐        │
│         │                        │                │        │
│         ▼                        ▼                ▼        │
│  ┌─────────────┐        ┌──────────────┐  ┌──────────┐   │
│  │ GitHub      │        │ Git          │  │ Claude   │   │
│  │ Client      │        │ Manager      │  │ Client   │   │
│  │             │        │              │  │          │   │
│  │ - Issue取得 │        │ - Worktree   │  │ - 実装   │   │
│  │ - PR作成    │        │ - Branch管理 │  │ - レビュー│   │
│  └─────────────┘        └──────────────┘  └──────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                       │                    │
         ▼                       ▼                    ▼
   ┌──────────┐          ┌────────────┐      ┌────────────┐
   │ GitHub   │          │ Git        │      │ Anthropic  │
   │ API      │          │ Worktree   │      │ API        │
   └──────────┘          └────────────┘      └────────────┘
```

## ディレクトリ構造

```
claude-runner/
├── claude-runner.yaml              # 設定ファイル（リポジトリには含めない）
├── claude-runner.example.yaml      # 設定ファイルのテンプレート
├── docs/
│   ├── architecture.md      # このファイル
│   ├── configuration.md     # 設定ファイルの詳細
│   └── workflow.md          # ワークフロー詳細
├── src/
│   ├── index.ts            # エントリーポイント
│   ├── types/
│   │   ├── config.ts       # 設定の型定義
│   │   ├── github.ts       # GitHub関連の型
│   │   └── claude.ts       # Claude関連の型
│   ├── config/
│   │   └── loader.ts       # YAML読み込み
│   ├── github/
│   │   └── client.ts       # GitHub API操作
│   ├── git/
│   │   ├── worktree.ts     # Worktree管理
│   │   └── branch.ts       # Branch操作
│   ├── claude/
│   │   ├── client.ts       # Claude API操作
│   │   ├── implementer.ts  # 実装ロジック
│   │   └── reviewer.ts     # レビューロジック
│   ├── orchestrator/
│   │   ├── index.ts        # メインの制御フロー
│   │   └── workflow.ts     # ワークフロー定義
│   └── utils/
│       ├── logger.ts       # ロギング
│       └── error.ts        # エラーハンドリング
├── .worktrees/             # Git worktree作成場所（自動生成）
├── logs/                   # 実行ログ（自動生成）
├── package.json
├── tsconfig.json
└── .gitignore
```

## 技術スタック

### 言語・ランタイム
- **TypeScript**: 型安全性とコード補完
- **Node.js**: v20以上

### 主要ライブラリ
- **@octokit/rest**: GitHub API クライアント
- **@anthropic-ai/sdk**: Claude API クライアント
- **yaml**: YAML パース
- **zod**: スキーマバリデーション
- **winston**: ロギング
- **commander**: CLI引数パース

### 開発ツール
- **tsx**: TypeScript直接実行
- **eslint**: リンター
- **prettier**: フォーマッター

## 主要コンポーネント

### 1. Config Loader
**責務**: YAML設定ファイルの読み込みとバリデーション

```typescript
interface Config {
  github: {
    owner: string;
    repo: string;
    token: string;
    labels: string[];
  };
  git: {
    baseBranch: string;
    worktreeDir: string;
    branchPrefix: string;
  };
  claude: {
    apiKey: string;
    model: string;
    maxRetries: number;
  };
  workflow: {
    autoReview: boolean;
    reviewIterations: number;
    autoCreatePR: boolean;
    autoPush: boolean;
  };
}
```

### 2. GitHub Client
**責務**: GitHub API との通信

**主要メソッド**:
- `getIssues(labels: string[]): Promise<Issue[]>` - ラベルでフィルタしてIssue一覧を取得
- `getIssue(issueNumber: number): Promise<Issue>` - 特定のIssueを取得
- `createPR(params: PRParams): Promise<PullRequest>` - プルリクエスト作成
- `addComment(issueNumber: number, body: string): Promise<void>` - Issueにコメント追加
- `addLabel(issueNumber: number, label: string): Promise<void>` - Issueにラベル追加
- `removeLabel(issueNumber: number, label: string): Promise<void>` - Issueからラベル削除

### 3. Git Manager
**責務**: Git worktree とブランチの管理

**主要メソッド**:
- `createWorktree(branch: string, path: string): Promise<Worktree>`
- `removeWorktree(path: string): Promise<void>`
- `getDiff(path: string): Promise<string>`
- `commitChanges(path: string, message: string): Promise<void>`
- `push(path: string, remote: string, branch: string): Promise<void>`

**Worktree 戦略**:
```
main-repo/
├── .git/
├── src/
└── .worktrees/
    ├── issue-123/     # Issue #123用のworktree
    │   └── src/
    ├── issue-124/     # Issue #124用のworktree
    │   └── src/
    └── issue-125/     # Issue #125用のworktree
        └── src/
```

### 4. Claude Client
**責務**: Claude API との通信と実装・レビューロジック

**Implementer**:
```typescript
async implement(issue: Issue, worktreePath: string): Promise<ImplementResult> {
  const prompt = `
以下のGitHub Issueを実装してください。

Issue #${issue.number}: ${issue.title}

${issue.body}

要件:
- 既存のコードスタイルに従う
- 必要に応じてテストを追加
- コミットメッセージは規約に従う
`;

  const result = await anthropic.messages.create({
    model: config.claude.model,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }]
  });

  return parseImplementResult(result);
}
```

**Reviewer**:
```typescript
async review(diff: string, issue: Issue): Promise<ReviewResult> {
  const prompt = `
以下の実装をレビューしてください。

元のIssue: ${issue.title}
${issue.body}

Diff:
${diff}

以下の観点でレビューしてください:
- 要件を満たしているか
- コードの品質
- セキュリティ上の問題
- テストの妥当性
- パフォーマンスの問題
`;

  const result = await anthropic.messages.create({
    model: config.claude.model,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }]
  });

  return parseReviewResult(result);
}
```

### 5. Orchestrator
**責務**: 全体のワークフロー制御

**メインフロー**:
```typescript
async function run() {
  // 1. 設定読み込み
  const config = await loadConfig();

  // 2. Issue取得
  const issues = await githubClient.getIssues(config.github.labels);

  // 3. 各Issueを順次処理
  for (const issue of issues) {
    try {
      await processIssue(issue, config);
    } catch (error) {
      logger.error(`Issue #${issue.number} の処理に失敗:`, error);
      await githubClient.addLabel(issue.number, 'claude-failed');
    }
  }
}

async function processIssue(issue: Issue, config: Config) {
  // 3.1. Worktree作成
  const worktreePath = path.join(config.git.worktreeDir, `issue-${issue.number}`);
  const branch = `${config.git.branchPrefix}${issue.number}`;
  await gitManager.createWorktree(branch, worktreePath);

  try {
    // 3.2. Claude で実装
    logger.info(`Issue #${issue.number} の実装を開始`);
    await claudeClient.implement(issue, worktreePath);

    // 3.3. 変更をコミット
    const diff = await gitManager.getDiff(worktreePath);
    if (!diff) {
      throw new Error('変更が検出されませんでした');
    }

    await gitManager.commitChanges(
      worktreePath,
      `Fix #${issue.number}: ${issue.title}\n\nCo-Authored-By: Claude <noreply@anthropic.com>`
    );

    // 3.4. レビュー実施（設定で有効な場合）
    if (config.workflow.autoReview) {
      for (let i = 0; i < config.workflow.reviewIterations; i++) {
        logger.info(`レビュー ${i + 1}回目`);
        const review = await claudeClient.review(diff, issue);

        if (!review.hasIssues) {
          logger.info('レビュー完了: 問題なし');
          break;
        }

        logger.info(`問題点が見つかりました: ${review.issues.length}件`);
        await claudeClient.implementFixes(review.issues, worktreePath);
      }
    }

    // 3.5. Push（設定で有効な場合）
    if (config.workflow.autoPush) {
      await gitManager.push(worktreePath, 'origin', branch);
    }

    // 3.6. PR作成（設定で有効な場合）
    if (config.workflow.autoCreatePR) {
      const pr = await githubClient.createPR({
        title: `Fix #${issue.number}: ${issue.title}`,
        body: `Closes #${issue.number}\n\n## 実装内容\n\nClaude による自動実装とレビューが完了しました。`,
        base: config.git.baseBranch,
        head: branch
      });

      logger.info(`PR作成完了: ${pr.html_url}`);
    }

    // 3.7. 成功ラベル追加
    await githubClient.addLabel(issue.number, 'claude-completed');

  } finally {
    // 3.8. Worktree削除
    await gitManager.removeWorktree(worktreePath);
  }
}
```

## Git Worktree の利点

### なぜ Worktree を使うのか

1. **複数Issue の並列処理が可能**
   - 各 Issue が独立した作業ディレクトリを持つ
   - 相互に干渉しない

2. **メインディレクトリの保護**
   - 実験的な変更がメインに影響しない
   - 安全にロールバック可能

3. **ブランチ切り替え不要**
   - 各 Worktree が専用のブランチを持つ
   - 高速な並列作業

### Worktree のライフサイクル

```bash
# 作成
git worktree add .worktrees/issue-123 -b claude/issue-123

# 作業
cd .worktrees/issue-123
# Claudeが実装...
git add .
git commit -m "Fix #123: ..."

# Push
git push origin claude/issue-123

# 削除
cd ../..
git worktree remove .worktrees/issue-123
```

## エラーハンドリング

### 想定されるエラーケース

1. **GitHub API エラー**
   - レート制限
   - 認証エラー
   - ネットワークエラー

2. **Git 操作エラー**
   - Worktree作成失敗
   - コミットエラー
   - Push失敗（競合など）

3. **Claude API エラー**
   - レート制限
   - タイムアウト
   - 無効なレスポンス

4. **実装エラー**
   - テスト失敗
   - ビルドエラー
   - 要件未達成

### エラーリカバリー戦略

```typescript
class ErrorHandler {
  async handle(error: Error, context: ErrorContext) {
    // ログ記録
    logger.error('エラー発生', { error, context });

    // GitHub Issueにコメント
    await githubClient.addComment(
      context.issueNumber,
      `⚠️ 自動実装中にエラーが発生しました:\n\n\`\`\`\n${error.message}\n\`\`\``
    );

    // 失敗ラベル追加
    await githubClient.addLabel(context.issueNumber, 'claude-failed');

    // Worktreeクリーンアップ
    if (context.worktreePath) {
      await gitManager.removeWorktree(context.worktreePath);
    }

    // リトライ判定
    if (this.isRetryable(error) && context.retryCount < 3) {
      logger.info('リトライします');
      return { retry: true };
    }

    return { retry: false };
  }

  isRetryable(error: Error): boolean {
    // レート制限やタイムアウトはリトライ可能
    return error.name === 'RateLimitError' ||
           error.name === 'TimeoutError';
  }
}
```

## セキュリティ考慮事項

### トークン管理
- GitHub Token と Anthropic API Key は環境変数で管理
- claude-runner.yaml はリポジトリにコミットしない（.gitignore に追加）
- claude-runner.example.yaml をテンプレートとして提供

### 実装内容の検証
- Claude の出力を盲目的に信頼しない
- レビューフェーズで二重チェック
- 自動 Push を無効にして人間の確認を挟むオプション

### API レート制限
```typescript
// GitHub API: 5000 requests/hour (認証時)
// Anthropic API: プランによる

class RateLimiter {
  private github: RateLimit;
  private claude: RateLimit;

  async waitIfNeeded(service: 'github' | 'claude') {
    const limiter = service === 'github' ? this.github : this.claude;
    if (limiter.remaining < 10) {
      const waitTime = limiter.reset - Date.now();
      logger.warn(`レート制限接近、${waitTime}ms 待機`);
      await sleep(waitTime);
    }
  }
}
```

## ログとモニタリング

### ログレベル
- **ERROR**: 回復不能なエラー
- **WARN**: 警告（リトライ可能なエラーなど）
- **INFO**: 主要なイベント（Issue処理開始/完了など）
- **DEBUG**: 詳細情報（API呼び出しなど）

### ログ出力先
- コンソール: INFO以上
- ファイル: すべてのレベル
  - `logs/claude-runner-YYYY-MM-DD.log`

### メトリクス
```typescript
interface Metrics {
  totalIssues: number;
  successCount: number;
  failureCount: number;
  averageTimePerIssue: number;
  totalTokensUsed: number;
  totalCost: number; // 概算
}
```

## パフォーマンス最適化

### 並列処理と競合検知

並列処理は効率的ですが、Issue 間の競合を検知して適切に処理する必要があります。

#### 競合の種類

1. **技術スタックの競合**
   - 例: Issue A が Next.js、Issue B が Nuxt.js の変更
   - 同じプロジェクトで異なるフレームワークを導入すると破綻

2. **同一ファイルの変更**
   - 複数の Issue が同じファイルを編集
   - マージ時にコンフリクト発生

3. **依存関係の競合**
   - package.json の同時変更
   - 異なるバージョンの依存関係を追加

4. **設定ファイルの競合**
   - tsconfig.json、.eslintrc などの設定変更
   - 相互に矛盾する設定の追加

#### 競合検知の実装

```typescript
class ConflictDetector {
  /**
   * Issue 間の競合を検出する
   */
  async detectConflicts(issues: Issue[]): Promise<IssueGroup[]> {
    // 各 Issue が影響する範囲を分析
    const issueScopes = await Promise.all(
      issues.map(issue => this.analyzeIssueScope(issue))
    );

    // 競合するペアを検出
    const conflicts = new Map<number, Set<number>>();

    for (let i = 0; i < issueScopes.length; i++) {
      for (let j = i + 1; j < issueScopes.length; j++) {
        if (this.hasConflict(issueScopes[i], issueScopes[j])) {
          if (!conflicts.has(i)) conflicts.set(i, new Set());
          if (!conflicts.has(j)) conflicts.set(j, new Set());
          conflicts.get(i)!.add(j);
          conflicts.get(j)!.add(i);
        }
      }
    }

    // 競合グラフから実行グループを作成
    return this.createExecutionGroups(issues, conflicts);
  }

  /**
   * Issue の影響範囲を分析
   */
  private async analyzeIssueScope(issue: Issue): Promise<IssueScope> {
    const body = issue.body.toLowerCase();
    const title = issue.title.toLowerCase();
    const text = `${title} ${body}`;

    return {
      issueNumber: issue.number,
      // 技術スタック検出
      techStack: this.detectTechStack(text),
      // 影響するファイルパターン推定
      filePatterns: this.estimateFilePatterns(text),
      // 依存関係変更の可能性
      dependencyChange: this.hasDependencyChange(text),
      // 設定ファイル変更の可能性
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
      'express': /\bexpress\b/i,
      'fastify': /\bfastify\b/i,
    };

    for (const [stack, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        stacks.add(stack);
      }
    }

    return stacks;
  }

  /**
   * 影響するファイルパターンを推定
   */
  private estimateFilePatterns(text: string): Set<string> {
    const patterns = new Set<string>();

    // 具体的なファイル名が言及されている場合
    const fileMatches = text.match(/[\w\-\.\/]+\.(ts|js|tsx|jsx|json|yaml|yml)/g);
    if (fileMatches) {
      fileMatches.forEach(f => patterns.add(f));
    }

    // コンポーネント名から推定
    if (/component/i.test(text)) {
      patterns.add('src/components/**/*');
    }

    // API関連
    if (/api|endpoint|route/i.test(text)) {
      patterns.add('src/api/**/*');
      patterns.add('src/routes/**/*');
    }

    return patterns;
  }

  /**
   * 依存関係変更の可能性をチェック
   */
  private hasDependencyChange(text: string): boolean {
    return /install|package|dependency|library|npm|yarn|pnpm/i.test(text);
  }

  /**
   * 設定ファイル変更の可能性をチェック
   */
  private hasConfigChange(text: string): boolean {
    return /config|tsconfig|eslint|prettier|webpack|vite/i.test(text);
  }

  /**
   * 2つの Issue が競合するかチェック
   */
  private hasConflict(scope1: IssueScope, scope2: IssueScope): boolean {
    // 技術スタックの競合
    // 例: Next.js と Nuxt.js は共存できない
    const conflictingStacks = [
      ['nextjs', 'nuxtjs'],
      ['react', 'vue'],
      ['react', 'angular'],
      ['vue', 'angular'],
    ];

    for (const [stack1, stack2] of conflictingStacks) {
      if (
        (scope1.techStack.has(stack1) && scope2.techStack.has(stack2)) ||
        (scope1.techStack.has(stack2) && scope2.techStack.has(stack1))
      ) {
        logger.warn(
          `技術スタック競合検出: Issue #${scope1.issueNumber} (${stack1}) と Issue #${scope2.issueNumber} (${stack2})`
        );
        return true;
      }
    }

    // ファイルパターンの重複
    const patterns1 = Array.from(scope1.filePatterns);
    const patterns2 = Array.from(scope2.filePatterns);

    for (const p1 of patterns1) {
      for (const p2 of patterns2) {
        if (this.patternsOverlap(p1, p2)) {
          logger.warn(
            `ファイル競合検出: Issue #${scope1.issueNumber} と Issue #${scope2.issueNumber} が ${p1} に影響`
          );
          return true;
        }
      }
    }

    // package.json への同時変更
    if (scope1.dependencyChange && scope2.dependencyChange) {
      logger.warn(
        `依存関係競合検出: Issue #${scope1.issueNumber} と Issue #${scope2.issueNumber} が両方とも依存関係を変更`
      );
      return true;
    }

    // 設定ファイルへの同時変更
    if (scope1.configChange && scope2.configChange) {
      logger.warn(
        `設定ファイル競合検出: Issue #${scope1.issueNumber} と Issue #${scope2.issueNumber} が両方とも設定を変更`
      );
      return true;
    }

    return false;
  }

  /**
   * ファイルパターンの重複チェック
   */
  private patternsOverlap(pattern1: string, pattern2: string): boolean {
    // 完全一致
    if (pattern1 === pattern2) return true;

    // ワイルドカードパターンの重複チェック（簡易版）
    // 例: src/components/Button.tsx と src/components/**/*
    const normalize = (p: string) => p.replace(/\*/g, '.*').replace(/\//g, '\\/');
    const regex1 = new RegExp(normalize(pattern1));
    const regex2 = new RegExp(normalize(pattern2));

    return regex1.test(pattern2) || regex2.test(pattern1);
  }

  /**
   * 競合グラフから実行グループを作成
   */
  private createExecutionGroups(
    issues: Issue[],
    conflicts: Map<number, Set<number>>
  ): IssueGroup[] {
    const groups: IssueGroup[] = [];
    const assigned = new Set<number>();

    for (let i = 0; i < issues.length; i++) {
      if (assigned.has(i)) continue;

      // 競合がない Issue は並列グループに追加可能
      if (!conflicts.has(i)) {
        // 既存の並列グループに追加できるか確認
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
          // 新しい並列グループを作成
          groups.push({
            parallel: true,
            issues: [issues[i]],
          });
          assigned.add(i);
        }
      } else {
        // 競合がある Issue は個別に実行
        groups.push({
          parallel: false,
          issues: [issues[i]],
        });
        assigned.add(i);
      }
    }

    return groups;
  }

  /**
   * Issue をグループに追加できるかチェック
   */
  private canAddToGroup(
    issueIndex: number,
    group: IssueGroup,
    conflicts: Map<number, Set<number>>
  ): boolean {
    const issueConflicts = conflicts.get(issueIndex);
    if (!issueConflicts) return true;

    // グループ内の Issue と競合しないことを確認
    for (const existingIssue of group.issues) {
      if (issueConflicts.has(existingIssue.number)) {
        return false;
      }
    }

    return true;
  }
}

interface IssueScope {
  issueNumber: number;
  techStack: Set<string>;
  filePatterns: Set<string>;
  dependencyChange: boolean;
  configChange: boolean;
}

interface IssueGroup {
  parallel: boolean;  // true = 並列実行可能、false = 順次実行
  issues: Issue[];
}
```

#### Orchestrator での使用

```typescript
async function run() {
  const config = await loadConfig();
  const issues = await githubClient.getIssues(config.github.labels);

  // 競合検知
  const detector = new ConflictDetector();
  const groups = await detector.detectConflicts(issues);

  logger.info(`実行グループ: ${groups.length}個`);
  groups.forEach((group, i) => {
    logger.info(
      `グループ ${i + 1}: ${group.parallel ? '並列' : '順次'} (${group.issues.length}件)`
    );
  });

  // グループごとに実行
  for (const group of groups) {
    if (group.parallel && config.workflow.maxConcurrency > 1) {
      // 並列実行
      logger.info(`並列実行開始: ${group.issues.length}件`);
      await Promise.all(
        group.issues.map(issue => processIssue(issue, config))
      );
    } else {
      // 順次実行
      logger.info(`順次実行開始: ${group.issues.length}件`);
      for (const issue of group.issues) {
        await processIssue(issue, config);
      }
    }
  }
}
```

### キャッシング
- GitHub Issue の取得結果をキャッシュ（短期間）
- Git diff の結果を一時保存
- Issue スコープ分析結果のキャッシュ

## 拡張性

### プラグインシステム（将来的な拡張）
```typescript
interface Plugin {
  name: string;
  beforeImplement?(context: Context): Promise<void>;
  afterImplement?(context: Context): Promise<void>;
  beforeReview?(context: Context): Promise<void>;
  afterReview?(context: Context): Promise<void>;
}
```

### カスタムプロンプト
```yaml
claude:
  customPrompts:
    implement: "path/to/implement-prompt.txt"
    review: "path/to/review-prompt.txt"
```

## 制限事項

1. **Claude Code CLI の制約**
   - API経由での直接制御が難しい
   - Anthropic SDK を使用した独自実装が必要

2. **Issue の複雑さ**
   - あまりに複雑なIssueは自動実装が困難
   - ラベルで実装可能なものを選別することを推奨

3. **テストの実行**
   - テストの実行環境が必要
   - CI/CDとの連携を検討

4. **レビューの精度**
   - Claude のレビューは補助的なもの
   - 最終的な人間のレビューが必要

## 次のステップ

1. **プロトタイプ実装** (フェーズ1)
   - 基本的な Issue 取得
   - Worktree 作成
   - 簡単な実装テスト

2. **Claude 統合** (フェーズ2)
   - Anthropic SDK 統合
   - プロンプトエンジニアリング

3. **レビューループ** (フェーズ3)
   - 自動レビュー実装
   - フィードバックループ

4. **本番運用** (フェーズ4)
   - エラーハンドリング強化
   - モニタリング
   - ドキュメント整備
