## 開発フロー

| シナリオ             | コマンド       | 内容                                       |
| -------------------- | -------------- | ------------------------------------------ |
| 依存取得             | `pnpm install` | 依存ライブラリ取得                         |
| 開発サーバ           | `pnpm dev`     | Vite 開発サーバ                            |
| 型+Svelte チェック   | `pnpm check`   | `svelte-check` による型/コンポーネント検証 |
| Lint & Prettier 検証 | `pnpm lint`    | Prettier 差分 + ESLint                     |
| 自動整形             | `pnpm format`  | Prettier で一括整形                        |

### Commit / PR 前のチェック (必須)

1. `pnpm format` を実行し整形差分を確定
2. `pnpm lint` で ESLint / Prettier チェックが全てパス
3. `pnpm check` で型エラーが無いこと

CIの想定シーケンス例: format → lint → type check。
`pnpm test:e2e`はローカル実行禁止 (GitHub Actions のみ)。

## コードスタイル / 設計指針

1. 同等/ほぼ同等なコードが現れたら抽出し、共通化、コンポーネント化することを検討する。重複ロジック、二重定義は早期に共通化する。
2. 整理されたコードを優先して、既存コードの踏襲は最小限にし、破壊的な変更も実施する。
3. 不要になったコード/型/データ (未使用の関数・変数・コンポーネント・CSV 列等) は速やかに削除しコメントアウト放置を避ける。
4. 1ファイルの責務はなるべく小さくし、コードの拡張により肥大化した場合は分割を検討する。

### CSS / スタイルルール

- レイアウト・スペーシングなどのマジックナンバーは極力避け、共通トークン化（ユーティリティ化/変数化）を検討する。

### コメント / ドキュメント

- 複雑な計算 (ダメージ、成長ロジック等) は数式や確率根拠を JSDoc で簡潔に記述。
- 意図を失いやすいマジックナンバーは禁止。`const` 命名で意味付け。
- コメントは全て英語で記述。日本語禁止。

### 表示文言 / i18n (Paraglide) ルール

- 画面に表示されるテキストは、必ず Paraglide 経由で提供すること。
  - 直接の文字列リテラル（ハードコード）は禁止。
- 反映手順:
  1.  `messages/ja.json` / `messages/en.json` にキーを追加・更新
  2.  `pnpm build` を実行して Paraglide の生成物を更新
  3.  コード側では `import { m } from '$lib/paraglide/messages'` を用い `m.key()` を呼び出して表示
- コンポーネント/サービス内で複数箇所に跨る文言は、必要に応じてキーを整理し、重複定義を避けること。
- 既存のハードコード文言を見つけた場合は、同PRで Paraglide への移行を行うこと。

## LLM 生成コードのガードレール

構造の崩壊や設計逸脱を防ぐため、LLM による生成・修正時は以下を厳守してください。

### 層と責務の境界

- data（`src/lib/data`）: データの取得・保持・永続化。Repository および **State（Source of Truth）** はここに含まれる。
- domain（`src/lib/domain`）: エンティティおよび純粋なビジネスルール。副作用（State更新、乱数、タイマー）を禁止する。
- presentation（`src/lib/presentation`）:
  - components: UI 部品。
  - state: UI 専用の状態（メニューの開閉など）。ゲームデータは持たない。
- services（`src/lib/services`）: アプリケーションの進行管理。状態遷移や乱数、非同期処理をここに集約する。
- routes（`src/routes`）: ページ構成（+page.svelte 等）のみ。コンポーネントは presentation/components へ配置する。

### 依存関係ルール

- 依存方向は presentation → domain → data の一方向。
- data/state はアプリケーションの Source of Truth であり、Repository を介して操作される。
- presentation 層は Repository を介して data/state を参照する。直接の state 更新は原則 Repository に委譲する。
- 共有ユーティリティは層に応じた場所へ配置（domain 用/ UI 専用を混在させない）。

### 型・命名・ファイル配置

- `any` 禁止。公開型や関数シグネチャ変更は全利用箇所を同一 PR で更新。
- 1 ファイル 1 責務。重複は抽出して共通化。命名は意図が伝わるように（動詞+対象 等）。
- インポートは既存のエイリアス（`$lib/...`）方針に合わせる。
- ゲーム共通で参照する数値定数（初期値、閾値、上限値、コスト等）は `src/lib/domain/constants` 配下に定義し、他層への分散定義を禁止する。

### UI / スタイル（Tailwind）

- `<style>` タグ禁止。Tailwind ユーティリティのみ使用。
- 重要度指定（`!important`/Tailwind の `!`）は原則禁止。
- 色は `@theme` の `--color-*` 変数を定義して `text-*` 等で参照（直書き禁止）。
- アイコンは `material-symbols` を使用。

### データ/CSV の扱い

- スキーマ変更（列追加/削除）は Repository を必ず同期更新し、破壊変更時は README/docs の更新も検討。
- csvはヘッダー行を必須とし、コメントの使用は禁止。

### 変更・PR チェックリスト（LLM 用）

1. 既存の型/関数/構造に整合。
2. CSV 変更時は Repository 同期・README/docs 更新を確認。更新。

### プレイヤー対称性

- 初期化・ターン進行など、ゲームルールに関わるロジックは `Player.SELF` / `Player.OPPONENT` を対称に扱うこと。
- 特定プレイヤーをハードコードせず、`turn.player` や引数の `player` を通じて処理を共通化する。
- 初期リソース・収入・パッシブ成長などのルール適用は、同一コードパスで両プレイヤーに適用されること。

### 禁止事項

- 依存方向の逆流、UI へのビジネスロジック混在、直接 DOM 操作の埋め込み。
- `any`、未使用コードの残置、色の直書き、任意 CSS の直付け、`<style>` タグ使用。
- ゲームルールに関わるロジックで `Player.SELF` / `Player.OPPONENT` を非対称に扱うこと（オンラインプレイで破綻するため）。

## サービス層の構成

詳細は [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) を参照。

| Service                  | 責務                                                        |
| ------------------------ | ----------------------------------------------------------- |
| **GameService**          | ファサード。初期化と各サブサービスへの委譲                  |
| **InteractionService**   | 盤面操作: 駒選択、パネルクリック、ハイライト計算            |
| **MovementRulesService** | 読み取り専用の移動ルール判定 (`canMoveTo`, `canCancelMove`) |
| **GenerationService**    | ユニット生成: 最適パネル検索、駒生成、リソース消費          |
| **CombatService**        | 戦闘解決: 駒 vs 駒、駒 vs 城壁                              |
| **PieceService**         | 駒 CRUD、移動実行、パッシブ成長                             |
| **PanelService**         | パネル初期化、隣接検索、状態クリア                          |
| **TurnAndAiService**     | ターン進行、リソース加算、AI 制御                           |
| **VictoryService**       | 勝利判定 (本拠地占領)                                       |
| **BoardLayoutService**   | 六角形座標計算                                              |

## 将来の改善候補

- 背面攻撃ボーナスを実装する際に、駒の向きを管理する仕組みが必要です。
- マスに値を付与するには駒が立ち止まっている必要があります。
- 基本用語の定義をこのファイルに追加してください。
- 六角形のパネルの表示をsvgで実装してください。
