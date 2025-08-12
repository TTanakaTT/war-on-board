# War on Board 仕様

このフォルダのトップには索引用の README のみを配置し、詳細仕様は分類ごとのサブディレクトリにまとめます。

分類:

- overview.md — 概要と用語、全体像
- functional/ — 機能仕様（ゲームロジック・AI挙動）
  - game-rules.md — ゲームルール（盤面、移動、戦闘、生成、リソース）
  - turn-and-ai.md — 手番、タイマー、AIターンの挙動
- ui-ux/ — UI/UX仕様
  - ui-ux-rules.md — 操作、表示、タイマー、スタイル
- architecture/ — コード構成・アーキテクチャ
  - domain-model.md — ドメインモデル（エンティティ/列挙/サービス/状態）

補足:

- 仕様の追加・変更は各分類内のMDへ追記してください。
