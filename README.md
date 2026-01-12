# Claude Runner

GitHub IssueをClaude AIが自動実装・PR作成するCLIツール

## インストール

```bash
npm install -g claude-runner
```

## セットアップ

1. `.env`ファイルを作成:
```bash
GITHUB_TOKEN=ghp_xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

2. `config.yaml`を作成（`config.example.yaml`を参考に）

3. リポジトリにラベルを作成:
- `claude-auto` - 処理対象
- `claude-processing` - 処理中
- `claude-completed` - 完了
- `claude-failed` - 失敗

## 使い方

```bash
# すべてのclaude-autoラベル付きIssueを処理
claude-runner

# 特定Issueのみ処理
claude-runner --issue 123

# 詳細ログ
claude-runner --verbose
```

## 詳細ドキュメント

- [Architecture](./docs/architecture.md)
- [Configuration](./docs/configuration.md)
- [Workflow](./docs/workflow.md)
- [Implementation Plan](./docs/implementation-plan.md)

## ライセンス

MIT
