# 設定ファイル詳細

## config.yaml の構造

### 基本構造

```yaml
# GitHub設定
github:
  owner: "your-organization"     # リポジトリのオーナー
  repo: "your-repository"        # リポジトリ名
  token: "${GITHUB_TOKEN}"       # GitHub Personal Access Token（環境変数推奨）
  labels:                        # 処理対象のラベル
    - "claude-auto-implement"
    - "good-first-issue"
  excludeLabels:                 # 除外するラベル
    - "wontfix"
    - "duplicate"

# Git設定
git:
  baseBranch: "main"                    # ベースブランチ
  worktreeDir: ".worktrees"             # worktree作成ディレクトリ
  branchPrefix: "claude/issue-"         # ブランチ名のプレフィックス
  commitMessageTemplate: |              # コミットメッセージテンプレート
    Fix #{{issue_number}}: {{issue_title}}

    {{issue_body}}

    Co-Authored-By: Claude <noreply@anthropic.com>

# Claude設定
claude:
  apiKey: "${ANTHROPIC_API_KEY}"        # Anthropic API Key（環境変数推奨）
  model: "claude-sonnet-4-5-20250929"   # 使用するモデル
  maxRetries: 3                          # リトライ回数
  timeout: 300000                        # タイムアウト（ミリ秒）
  temperature: 0.0                       # 温度パラメータ（0.0-1.0）
  maxTokens: 8000                        # 最大トークン数

# ワークフロー設定
workflow:
  autoReview: true                # 実装後の自動レビュー
  reviewIterations: 2             # レビュー→修正の最大回数
  autoCreatePR: true              # PR自動作成
  autoPush: false                 # 自動Push（false推奨）
  maxConcurrency: 1               # 同時処理数（1推奨）
  runTests: true                  # テスト実行
  testCommand: "npm test"         # テストコマンド
  buildBeforeTest: true           # テスト前にビルド
  buildCommand: "npm run build"   # ビルドコマンド

# 通知設定（オプション）
notification:
  enabled: true
  slack:
    webhookUrl: "${SLACK_WEBHOOK_URL}"
    channel: "#claude-runner"
    onSuccess: true
    onFailure: true

# ログ設定
logging:
  level: "info"                   # error, warn, info, debug
  outputDir: "logs"               # ログ出力ディレクトリ
  maxFiles: 30                    # 保持する最大ファイル数
  maxSize: "10m"                  # 1ファイルの最大サイズ
```

## 設定項目の詳細

### GitHub 設定

#### `github.owner` (必須)
- **型**: string
- **説明**: GitHubリポジトリのオーナー（組織名またはユーザー名）
- **例**: `"microsoft"`, `"facebook"`

#### `github.repo` (必須)
- **型**: string
- **説明**: リポジトリ名
- **例**: `"vscode"`, `"react"`

#### `github.token` (必須)
- **型**: string
- **説明**: GitHub Personal Access Token
- **必要なスコープ**:
  - `repo` (プライベートリポジトリの場合)
  - `public_repo` (パブリックリポジトリの場合)
  - `read:org` (組織のリポジトリの場合)
- **推奨**: 環境変数で管理（`${GITHUB_TOKEN}`）
- **取得方法**: https://github.com/settings/tokens

#### `github.labels` (必須)
- **型**: string[]
- **説明**: 処理対象のラベル（OR条件）
- **例**: `["claude-auto-implement", "good-first-issue"]`
- **注意**: このラベルが付いている Issue のみが処理される

#### `github.excludeLabels` (オプション)
- **型**: string[]
- **説明**: 除外するラベル
- **例**: `["wontfix", "duplicate", "invalid"]`
- **デフォルト**: `[]`

### Git 設定

#### `git.baseBranch` (必須)
- **型**: string
- **説明**: PRのベースとなるブランチ
- **例**: `"main"`, `"develop"`, `"master"`
- **デフォルト**: `"main"`

#### `git.worktreeDir` (必須)
- **型**: string
- **説明**: Git worktree を作成するディレクトリ
- **例**: `".worktrees"`, `"tmp/worktrees"`
- **デフォルト**: `".worktrees"`
- **注意**: このディレクトリは `.gitignore` に追加すること

#### `git.branchPrefix` (必須)
- **型**: string
- **説明**: 作成するブランチ名のプレフィックス
- **例**: `"claude/issue-"`, `"auto/"`
- **結果**: `claude/issue-123`, `auto/456`
- **デフォルト**: `"claude/issue-"`

#### `git.commitMessageTemplate` (オプション)
- **型**: string (multiline)
- **説明**: コミットメッセージのテンプレート
- **変数**:
  - `{{issue_number}}`: Issue番号
  - `{{issue_title}}`: Issueタイトル
  - `{{issue_body}}`: Issue本文（短縮版）
- **デフォルト**: 上記のYAML例を参照

### Claude 設定

#### `claude.apiKey` (必須)
- **型**: string
- **説明**: Anthropic API Key
- **推奨**: 環境変数で管理（`${ANTHROPIC_API_KEY}`）
- **取得方法**: https://console.anthropic.com/settings/keys

#### `claude.model` (必須)
- **型**: string
- **説明**: 使用するClaudeモデル
- **選択肢**:
  - `"claude-sonnet-4-5-20250929"` (推奨: バランス型)
  - `"claude-opus-4-5-20251101"` (最高品質、コスト高)
  - `"claude-3-5-haiku-20241022"` (高速、コスト低)
- **デフォルト**: `"claude-sonnet-4-5-20250929"`

#### `claude.maxRetries` (オプション)
- **型**: number
- **説明**: API呼び出し失敗時のリトライ回数
- **範囲**: 0-10
- **デフォルト**: `3`

#### `claude.timeout` (オプション)
- **型**: number
- **説明**: API呼び出しのタイムアウト（ミリ秒）
- **範囲**: 10000-600000 (10秒-10分)
- **デフォルト**: `300000` (5分)

#### `claude.temperature` (オプション)
- **型**: number
- **説明**: 出力のランダム性（0.0=決定的、1.0=ランダム）
- **範囲**: 0.0-1.0
- **デフォルト**: `0.0`
- **推奨**: コード生成には `0.0` を推奨

#### `claude.maxTokens` (オプション)
- **型**: number
- **説明**: レスポンスの最大トークン数
- **範囲**: 1-8192
- **デフォルト**: `8000`

### ワークフロー設定

#### `workflow.autoReview` (オプション)
- **型**: boolean
- **説明**: 実装後に自動レビューを実行するか
- **デフォルト**: `true`
- **推奨**: `true`（品質向上のため）

#### `workflow.reviewIterations` (オプション)
- **型**: number
- **説明**: レビュー→修正のサイクル回数
- **範囲**: 0-5
- **デフォルト**: `2`
- **注意**: 多すぎるとコストが増加

#### `workflow.autoCreatePR` (オプション)
- **型**: boolean
- **説明**: 実装完了後に自動でPRを作成するか
- **デフォルト**: `true`

#### `workflow.autoPush` (オプション)
- **型**: boolean
- **説明**: コミット後に自動でPushするか
- **デフォルト**: `false`
- **推奨**: `false`（手動確認を推奨）
- **注意**: `true` にすると人間の確認なしでPushされる

#### `workflow.maxConcurrency` (オプション)
- **型**: number
- **説明**: 同時に処理するIssue数
- **範囲**: 1-10
- **デフォルト**: `1`
- **推奨**: `1`（Git操作の競合を避けるため）
- **注意**: 2以上にする場合はレート制限に注意

#### `workflow.runTests` (オプション)
- **型**: boolean
- **説明**: 実装後にテストを実行するか
- **デフォルト**: `true`
- **推奨**: `true`（品質保証のため）

#### `workflow.testCommand` (オプション)
- **型**: string
- **説明**: テスト実行コマンド
- **例**: `"npm test"`, `"yarn test"`, `"pytest"`
- **デフォルト**: `"npm test"`

#### `workflow.buildBeforeTest` (オプション)
- **型**: boolean
- **説明**: テスト前にビルドするか
- **デフォルト**: `true`

#### `workflow.buildCommand` (オプション)
- **型**: string
- **説明**: ビルドコマンド
- **例**: `"npm run build"`, `"yarn build"`, `"make"`
- **デフォルト**: `"npm run build"`

### 通知設定（オプション）

#### `notification.enabled` (オプション)
- **型**: boolean
- **説明**: 通知機能を有効にするか
- **デフォルト**: `false`

#### `notification.slack.webhookUrl` (オプション)
- **型**: string
- **説明**: Slack Incoming Webhook URL
- **推奨**: 環境変数で管理

#### `notification.slack.channel` (オプション)
- **型**: string
- **説明**: 通知先チャンネル
- **例**: `"#claude-runner"`

#### `notification.slack.onSuccess` (オプション)
- **型**: boolean
- **説明**: 成功時に通知するか
- **デフォルト**: `true`

#### `notification.slack.onFailure` (オプション)
- **型**: boolean
- **説明**: 失敗時に通知するか
- **デフォルト**: `true`

### ログ設定

#### `logging.level` (オプション)
- **型**: string
- **説明**: ログレベル
- **選択肢**: `"error"`, `"warn"`, `"info"`, `"debug"`
- **デフォルト**: `"info"`

#### `logging.outputDir` (オプション)
- **型**: string
- **説明**: ログファイルの出力ディレクトリ
- **デフォルト**: `"logs"`

#### `logging.maxFiles` (オプション)
- **型**: number
- **説明**: 保持する最大ログファイル数
- **デフォルト**: `30`

#### `logging.maxSize` (オプション)
- **型**: string
- **説明**: 1ファイルの最大サイズ
- **例**: `"10m"`, `"100k"`
- **デフォルト**: `"10m"`

## 環境変数

### 必須の環境変数

```bash
# GitHub Personal Access Token
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"

# Anthropic API Key
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxx"
```

### オプションの環境変数

```bash
# Slack通知用
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxx/yyy/zzz"

# カスタム設定ファイルパス
export CLAUDE_RUNNER_CONFIG="/path/to/config.yaml"
```

### .env ファイルの使用

```bash
# .env ファイル作成
cat > .env << EOF
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
EOF

# .env を .gitignore に追加
echo ".env" >> .gitignore
```

## config.example.yaml

リポジトリに含める設定ファイルのテンプレート:

```yaml
# Claude Runner 設定ファイル
# このファイルをコピーして config.yaml を作成してください
# cp config.example.yaml config.yaml

github:
  owner: "your-organization"
  repo: "your-repository"
  token: "${GITHUB_TOKEN}"
  labels:
    - "claude-auto-implement"

git:
  baseBranch: "main"
  worktreeDir: ".worktrees"
  branchPrefix: "claude/issue-"

claude:
  apiKey: "${ANTHROPIC_API_KEY}"
  model: "claude-sonnet-4-5-20250929"
  maxRetries: 3
  temperature: 0.0
  maxTokens: 8000

workflow:
  autoReview: true
  reviewIterations: 2
  autoCreatePR: true
  autoPush: false          # 安全のため false を推奨
  maxConcurrency: 1
  runTests: true
  testCommand: "npm test"

logging:
  level: "info"
  outputDir: "logs"
```

## バリデーション

設定ファイルは起動時に Zod を使ってバリデーションされます:

```typescript
import { z } from 'zod';

const configSchema = z.object({
  github: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    token: z.string().regex(/^(ghp_|gho_|ghs_|ghu_)/),
    labels: z.array(z.string()).min(1),
    excludeLabels: z.array(z.string()).optional(),
  }),
  git: z.object({
    baseBranch: z.string().min(1),
    worktreeDir: z.string().min(1),
    branchPrefix: z.string(),
  }),
  claude: z.object({
    apiKey: z.string().regex(/^sk-ant-/),
    model: z.enum([
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251101',
      'claude-3-5-haiku-20241022',
    ]),
    maxRetries: z.number().int().min(0).max(10).default(3),
    timeout: z.number().int().min(10000).max(600000).default(300000),
    temperature: z.number().min(0).max(1).default(0),
    maxTokens: z.number().int().min(1).max(8192).default(8000),
  }),
  workflow: z.object({
    autoReview: z.boolean().default(true),
    reviewIterations: z.number().int().min(0).max(5).default(2),
    autoCreatePR: z.boolean().default(true),
    autoPush: z.boolean().default(false),
    maxConcurrency: z.number().int().min(1).max(10).default(1),
    runTests: z.boolean().default(true),
    testCommand: z.string().default('npm test'),
    buildBeforeTest: z.boolean().default(true),
    buildCommand: z.string().default('npm run build'),
  }),
  notification: z.object({
    enabled: z.boolean().default(false),
    slack: z.object({
      webhookUrl: z.string().url().optional(),
      channel: z.string().optional(),
      onSuccess: z.boolean().default(true),
      onFailure: z.boolean().default(true),
    }).optional(),
  }).optional(),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    outputDir: z.string().default('logs'),
    maxFiles: z.number().int().default(30),
    maxSize: z.string().default('10m'),
  }).optional(),
});

export type Config = z.infer<typeof configSchema>;
```

## セキュリティのベストプラクティス

1. **トークンの管理**
   - config.yaml をリポジトリにコミットしない
   - .gitignore に config.yaml を追加
   - 環境変数を使用

2. **権限の最小化**
   - GitHub Token は必要最小限のスコープのみ
   - 読み取り専用の操作には `read:*` スコープを使用

3. **監査ログ**
   - すべてのAPI呼び出しをログに記録
   - 重要な操作は警告レベルでログ

4. **レビューの徹底**
   - `autoPush: false` を推奨
   - 人間による最終確認を必須に
