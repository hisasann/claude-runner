# 配布方法の検討

## 提供形態の選択肢

### 1. npm パッケージ（CLI）⭐️ 推奨

#### パッケージ名候補
- `@your-org/claude-runner`
- `claude-issue-runner`
- `ai-issue-automation`

#### インストール方法

**グローバルインストール**:
```bash
npm install -g claude-runner
claude-runner --config ./config.yaml
```

**npx で直接実行**:
```bash
npx claude-runner --config ./config.yaml
```

**プロジェクトローカル**:
```bash
npm install --save-dev claude-runner
npx claude-runner
```

#### メリット
- ✅ Node.js エコシステムとの親和性が高い
- ✅ バージョン管理が容易（semantic versioning）
- ✅ 依存関係の管理が npm に任せられる
- ✅ ユーザーが使い慣れている
- ✅ CI/CD への統合が簡単
- ✅ アップデートが容易

#### デメリット
- ❌ Node.js がインストールされている必要がある
- ❌ 起動が若干遅い（Node.js の起動時間）
- ❌ 環境差異（Node.js のバージョン違い）

#### package.json の設定

```json
{
  "name": "claude-runner",
  "version": "1.0.0",
  "description": "GitHub Issue を Claude が自動実装・レビュー・PR作成",
  "keywords": [
    "github",
    "claude",
    "ai",
    "automation",
    "issue",
    "pull-request"
  ],
  "bin": {
    "claude-runner": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/claude-runner"
  },
  "author": "Your Name",
  "license": "MIT"
}
```

#### CLI エントリーポイント

**ファイル**: `src/cli.ts`
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { run } from './index.js';

const program = new Command();

program
  .name('claude-runner')
  .description('GitHub Issue の自動実装・レビュー・PR作成ツール')
  .version('1.0.0')
  .option('-c, --config <path>', '設定ファイルのパス', 'config.yaml')
  .option('-i, --issue <number>', '特定の Issue のみ処理')
  .option('--dry-run', 'Dry run モード')
  .option('-v, --verbose', '詳細ログ')
  .action(async (options) => {
    try {
      await run(options);
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
```

---

### 2. Docker イメージ

#### 使用方法

```bash
# Pull
docker pull your-org/claude-runner:latest

# Run
docker run -v $(pwd)/config.yaml:/app/config.yaml \
           -v $(pwd)/.git:/app/.git \
           -e GITHUB_TOKEN=$GITHUB_TOKEN \
           -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
           your-org/claude-runner
```

#### メリット
- ✅ 環境の一貫性（Node.js バージョン固定）
- ✅ 依存関係が全て含まれている
- ✅ クリーンな実行環境
- ✅ CI/CD での使用が容易

#### デメリット
- ❌ Docker のインストールが必要
- ❌ イメージサイズが大きい（数百MB）
- ❌ ボリュームマウントの設定が必要
- ❌ Git 操作が複雑になる可能性

#### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 依存関係インストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコピー
COPY dist ./dist

# Git をインストール
RUN apk add --no-cache git

# エントリーポイント
ENTRYPOINT ["node", "dist/cli.js"]
```

---

### 3. スタンドアロンバイナリ

#### ツール
- **pkg**: Node.js をバイナリに変換
- **bun build**: Bun の組み込みコンパイラ
- **esbuild + postject**: カスタムビルド

#### 使用方法

```bash
# ダウンロード
curl -L https://github.com/your-org/claude-runner/releases/latest/download/claude-runner-macos -o claude-runner
chmod +x claude-runner

# 実行
./claude-runner --config config.yaml
```

#### メリット
- ✅ Node.js のインストール不要
- ✅ 配布が簡単（単一ファイル）
- ✅ 起動が高速
- ✅ バージョン管理が明確

#### デメリット
- ❌ プラットフォームごとにビルドが必要（macOS, Linux, Windows）
- ❌ バイナリサイズが大きい（50-100MB）
- ❌ アップデートの仕組みを自前で用意する必要がある
- ❌ ビルドプロセスが複雑

---

### 4. GitHub Action

GitHub Actions として提供し、CI/CD に統合する形式。

#### 使用方法

```yaml
# .github/workflows/claude-runner.yml
name: Auto Implement Issues

on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごと
  workflow_dispatch:       # 手動実行も可能

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Claude Runner
        uses: your-org/claude-runner-action@v1
        with:
          config: ./config.yaml
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

#### メリット
- ✅ GitHub との統合が自然
- ✅ cron で定期実行可能
- ✅ GitHub Secrets で認証情報を管理
- ✅ ログが GitHub に残る
- ✅ ローカル環境不要

#### デメリット
- ❌ GitHub Actions の実行時間制限（月間上限あり）
- ❌ ローカルでのテストが困難
- ❌ GitHub 以外では使えない

---

### 5. SaaS（Web サービス）

Web サービスとして提供し、Webhook で自動実行。

#### アーキテクチャ

```
GitHub → Webhook → あなたのサービス → Claude API
                         ↓
                    データベース
                    設定管理
                    課金システム
```

#### メリット
- ✅ インストール不要
- ✅ Web UI で設定・監視
- ✅ マルチテナント対応
- ✅ 収益化しやすい

#### デメリット
- ❌ 開発・運用コストが高い
- ❌ セキュリティリスク（API キーの管理）
- ❌ インフラコスト
- ❌ ユーザーのコードを外部サーバーで扱う必要がある

---

## 推奨アプローチ

### フェーズ 1: npm パッケージ（CLI）🎯

まずは **npm パッケージ** として提供することを推奨します。

**理由**:
1. 開発が最もシンプル
2. ユーザーが自分の環境で実行できる（セキュリティ）
3. バージョン管理が容易
4. 他の形態への拡張が可能（Docker は npm ベースでビルドできる）

### フェーズ 2: GitHub Action（オプション）

npm パッケージが安定したら、GitHub Action でラップする。

```yaml
# action.yml
name: 'Claude Runner'
description: 'GitHub Issue の自動実装・レビュー・PR作成'
inputs:
  config:
    description: '設定ファイルのパス'
    required: true
  github-token:
    description: 'GitHub Token'
    required: true
  anthropic-api-key:
    description: 'Anthropic API Key'
    required: true

runs:
  using: 'node20'
  main: 'dist/action.js'
```

### フェーズ 3: Docker イメージ（オプション）

企業ユーザー向けに Docker イメージも提供。

---

## npm パッケージとしての公開手順

### 1. パッケージの準備

```bash
# package.json を最終調整
npm version 1.0.0

# ビルド
npm run build

# テスト公開（ローカル）
npm pack
# → claude-runner-1.0.0.tgz が生成される
```

### 2. npm アカウントの準備

```bash
# npm アカウント作成
npm adduser

# 組織を作成（オプション）
# https://www.npmjs.com/org/create
```

### 3. 公開

```bash
# 初回公開
npm publish --access public

# アップデート
npm version patch  # 1.0.0 → 1.0.1
npm publish
```

### 4. README の整備

```markdown
# Claude Runner

GitHub Issue を Claude が自動実装・レビュー・PR作成するツール

## インストール

\`\`\`bash
npm install -g claude-runner
\`\`\`

## クイックスタート

1. 設定ファイルを作成:
\`\`\`bash
cp node_modules/claude-runner/config.example.yaml config.yaml
\`\`\`

2. 環境変数を設定:
\`\`\`bash
export GITHUB_TOKEN="your-token"
export ANTHROPIC_API_KEY="your-key"
\`\`\`

3. 実行:
\`\`\`bash
claude-runner --config config.yaml
\`\`\`

## ドキュメント

詳細は [docs/](./docs/) を参照してください。
```

---

## ライセンス選択

### オープンソースの場合

**MIT License** 推奨
- 最も自由度が高い
- 商用利用可能
- npm パッケージの標準

**Apache 2.0**
- 特許条項が含まれる
- 企業利用に適している

### クローズドソースの場合

**Proprietary License**
- 利用規約を明記
- 商用製品として販売可能

---

## モノレポ構成（将来的に）

複数のパッケージに分割する場合:

```
claude-runner/
├── packages/
│   ├── cli/              # CLI パッケージ
│   ├── core/             # コアロジック
│   ├── github-action/    # GitHub Action
│   └── docker/           # Docker イメージ
├── docs/
└── examples/
```

---

## まとめ

**推奨順序**:
1. **npm パッケージ（CLI）** として公開 ← まずはこれ
2. GitHub Action でラップ（オプション）
3. Docker イメージ提供（エンタープライズ向け）
4. SaaS 化（大規模展開の場合）

最初は npm パッケージで始めて、ユーザーの反応を見ながら他の形態を追加していくのが現実的です。
