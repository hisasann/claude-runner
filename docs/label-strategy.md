# GitHub Label 戦略

## ラベル名の候補

### オプション 1: シンプル＆明確 ⭐️ 推奨

**メインラベル**: `claude-auto`

**理由**:
- ✅ 短くて覚えやすい
- ✅ 誤解の余地がない
- ✅ タイプしやすい

**使用例**:
```yaml
github:
  labels:
    - "claude-auto"
```

---

### オプション 2: 詳細な説明

**メインラベル**: `claude-auto-implement`

**理由**:
- ✅ 何をするのか明確
- ✅ 他のClaudeラベルと区別しやすい（将来的に claude-auto-review などを追加）
- ⚠️ 少し長い

---

### オプション 3: AI汎用

**メインラベル**: `ai-auto`

**理由**:
- ✅ Claude以外のAIツールでも使える
- ✅ 将来的な拡張性
- ❌ 具体性に欠ける

---

### オプション 4: アクション重視

**メインラベル**: `auto-implement`

**理由**:
- ✅ アクションが明確
- ❌ どのツールが処理するか不明

---

## 推奨ラベルセット

### 基本セット

```yaml
github:
  labels:
    - "claude-auto"        # メインラベル（必須）
```

### 優先度付きセット

```yaml
github:
  labels:
    - "claude-auto"        # メインラベル
  # 優先度ラベル（オプション）
  # これらは既存のIssue管理ラベルと併用
```

既存の優先度ラベルを使用:
- `priority-high` → 先に処理
- `priority-medium` → 通常
- `priority-low` → 後回し

---

## 状態管理ラベル（自動付与）

Claude Runner が処理中・完了時に自動で付与するラベル:

### 1. `claude-processing` 🔵
- **タイミング**: 処理開始時
- **意味**: 現在 Claude が実装中
- **削除**: 完了時または失敗時

### 2. `claude-completed` 🟢
- **タイミング**: 処理成功時
- **意味**: 実装完了、PR作成済み
- **備考**: このラベルがついた Issue は次回スキップ

### 3. `claude-failed` 🔴
- **タイミング**: 処理失敗時
- **意味**: エラーが発生して処理失敗
- **備考**: 問題解決後、手動でラベルを削除すれば再実行される

### 4. `claude-reviewed` 🟡（オプション）
- **タイミング**: レビュー完了時
- **意味**: コードレビューが完了したが、修正待ち

---

## 除外ラベル（デフォルト）

これらのラベルが付いている Issue は処理しない:

```yaml
github:
  excludeLabels:
    - "wontfix"           # 対応しない
    - "duplicate"         # 重複
    - "invalid"           # 無効
    - "claude-completed"  # 既に完了
    - "claude-failed"     # 失敗（手動で削除するまで）
    - "on-hold"           # 保留中
```

---

## ラベルの運用フロー

### 1. Issue 作成時

```
Issue #123: "Add login button"
Labels: bug, frontend
```

### 2. ユーザーがラベルを追加

```
Issue #123: "Add login button"
Labels: bug, frontend, claude-auto  ← 追加
```

### 3. Claude Runner が検出

```
✓ Issue #123 を検出
  Labels: bug, frontend, claude-auto
```

### 4. 処理開始

```
Issue #123: "Add login button"
Labels: bug, frontend, claude-auto, claude-processing  ← 自動追加
```

### 5. 処理完了

```
Issue #123: "Add login button"
Labels: bug, frontend, claude-auto, claude-completed  ← 自動変更
                                    ↑ processing 削除
```

### 6. PR が作成される

```
Pull Request #124: "Fix #123: Add login button"
Closes #123
```

---

## 複数ラベルの組み合わせ例

### パターン 1: 優先度管理

```yaml
# config.yaml
github:
  labels:
    - "claude-auto"
```

Issue に以下の組み合わせでラベルを付与:
- `claude-auto` + `priority-high` → 最優先で処理
- `claude-auto` + `priority-low` → 後で処理
- `claude-auto` のみ → 通常の優先度

### パターン 2: カテゴリ別管理

```yaml
github:
  labels:
    - "claude-auto"
    - "good-first-issue"  # 簡単なタスク
```

両方のラベルが付いている Issue を処理する（OR条件）

### パターン 3: 段階的な導入

**ステップ 1**: まず簡単な Issue だけ
```yaml
github:
  labels:
    - "claude-auto"
    - "good-first-issue"
```

**ステップ 2**: 慣れてきたら範囲を広げる
```yaml
github:
  labels:
    - "claude-auto"
```

---

## ラベルの色設定（推奨）

GitHub でラベルを作成する際の色:

| ラベル | 色 | 16進数 |
|--------|------|---------|
| `claude-auto` | 紫 | `#8B5CF6` |
| `claude-processing` | 青 | `#3B82F6` |
| `claude-completed` | 緑 | `#10B981` |
| `claude-failed` | 赤 | `#EF4444` |
| `claude-reviewed` | 黄 | `#F59E0B` |

---

## GitHub CLI でラベルを一括作成

```bash
#!/bin/bash

# リポジトリ情報
OWNER="your-org"
REPO="your-repo"

# メインラベル
gh label create "claude-auto" \
  --description "Claude Runner が自動実装する" \
  --color "8B5CF6" \
  --repo "$OWNER/$REPO"

# 状態管理ラベル
gh label create "claude-processing" \
  --description "Claude が処理中" \
  --color "3B82F6" \
  --repo "$OWNER/$REPO"

gh label create "claude-completed" \
  --description "Claude が処理完了" \
  --color "10B981" \
  --repo "$OWNER/$REPO"

gh label create "claude-failed" \
  --description "Claude の処理が失敗" \
  --color "EF4444" \
  --repo "$OWNER/$REPO"
```

---

## CLI コマンドでラベル作成機能を提供

Claude Runner 自体にラベル作成機能を組み込む:

```bash
# ラベルを自動作成
claude-runner setup-labels --repo your-org/your-repo

# 出力例:
# ✓ claude-auto を作成しました
# ✓ claude-processing を作成しました
# ✓ claude-completed を作成しました
# ✓ claude-failed を作成しました
```

**実装**:
```typescript
// src/cli.ts
program
  .command('setup-labels')
  .description('必要なラベルをリポジトリに作成')
  .option('--repo <owner/repo>', 'リポジトリ指定')
  .action(async (options) => {
    await setupLabels(options);
  });

async function setupLabels(options) {
  const labels = [
    { name: 'claude-auto', description: 'Claude Runner が自動実装', color: '8B5CF6' },
    { name: 'claude-processing', description: 'Claude が処理中', color: '3B82F6' },
    { name: 'claude-completed', description: 'Claude が処理完了', color: '10B981' },
    { name: 'claude-failed', description: 'Claude の処理が失敗', color: 'EF4444' },
  ];

  for (const label of labels) {
    try {
      await githubClient.createLabel(label);
      console.log(`✓ ${label.name} を作成しました`);
    } catch (error) {
      if (error.status === 422) {
        console.log(`- ${label.name} は既に存在します`);
      } else {
        throw error;
      }
    }
  }
}
```

---

## 特殊ケース

### ケース 1: Dependabot との併用

Dependabot の PR にも `claude-auto` を付けることで、自動レビュー・マージが可能:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "claude-auto"  # ← 追加
```

### ケース 2: Issue テンプレートでデフォルト設定

```markdown
---
name: Feature Request
about: 新機能の提案
labels: enhancement, claude-auto
---

## 機能の説明
...
```

---

## まとめ

### 推奨設定 ⭐️

**メインラベル**: `claude-auto`

**設定例**:
```yaml
github:
  labels:
    - "claude-auto"
  excludeLabels:
    - "wontfix"
    - "duplicate"
    - "invalid"
```

**運用**:
1. 自動化したい Issue に `claude-auto` ラベルを付与
2. Claude Runner が自動で検出して処理
3. 処理中は `claude-processing` が自動付与
4. 完了すると `claude-completed` に変更
5. PR が自動作成される

シンプルで明確、誤操作の心配も少ない設計です。
