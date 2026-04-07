## 開発フロー

| シナリオ             | コマンド          | 内容                                       |
| -------------------- | ----------------- | ------------------------------------------ |
| 依存取得             | `pnpm install`    | 依存ライブラリ取得                         |
| 開発サーバ           | `pnpm dev`        | Vite 開発サーバ                            |
| 型+Svelte チェック   | `pnpm check`      | `svelte-check` による型/コンポーネント検証 |
| Lint & Prettier 検証 | `pnpm lint`       | Prettier 差分 + ESLint                     |
| 自動整形             | `pnpm format`     | Prettier で一括整形                        |
| ユニットテスト       | `pnpm test`       | Vitest 実行                                |
| テスト (watch)       | `pnpm test:watch` | Vitest watch モード                        |

### TDD 開発プロセス (標準フロー)

すべての機能開発は以下の 4 ステップで進める。

1. **[人間]** 仕様の入力 — 自然言語または copilot-instructions.md / GameApi TSDoc への追記。
2. **[AI]** テストケースファイルの作成 — テストファイルを作成し、`describe` / `test` の構造と名前のみを定義。テスト関数の中身は空にする。
3. **[人間]** テストケースのレビュー・確定 — テストファイル上で網羅性・妥当性を確認。ケースの追加・削除・名称変更を指示。
4. **[人間]** テストケース確定後、「**テストケース確定。実装してください。**」と入力。
5. **[AI]** テストコード + 実装 — 確定したテストケースに基づきテスト本体と実装を同時に作成。全テスト pass。

### Commit / PR 前のチェック (必須)

1. `pnpm format` を実行し整形差分を確定
2. `pnpm lint` で ESLint / Prettier チェックが全てパス
3. `pnpm check` で型エラーが無いこと
4. `pnpm test` でユニットテストが全てパス

CI の想定シーケンス: format check → lint → type check → unit test。
`pnpm test:e2e` はローカル実行禁止 (GitHub Actions のみ)。

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
- md ファイル以外のソースコード（テスト含む）では日本語を使用しない。

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

- **api**（`src/lib/api`）: ゲーム操作の唯一の入口。`GameApi` が全アクション/クエリを提供する。仕様は TSDoc に記述し、テストで検証する。
- **data**（`src/lib/data`）: データの取得・保持・永続化。Repository および **State（Source of Truth）** はここに含まれる。
- **domain**（`src/lib/domain`）: エンティティおよび純粋なビジネスルール。副作用（State更新、乱数、タイマー）を禁止する。
- **presentation**（`src/lib/presentation`）:
  - components: UI 部品。
  - state: UI 専用の状態（メニューの開閉など）。ゲームデータは持たない。
- **services**（`src/lib/services`）: GameApi の内部実装。アプリケーションの進行管理。状態遷移や乱数、非同期処理をここに集約する。
- **routes**（`src/routes`）: ページ構成（+page.svelte 等）のみ。コンポーネントは presentation/components へ配置する。

### ゲーム操作ルール

- **ゲーム状態を変更する操作は全て `GameApi` 経由**で行うこと。コンポーネントやサービスが直接 Repository を書き換えてゲーム状態を変更してはならない。
- **UI 状態の管理** (パネルのハイライト、選択状態) は `InteractionService` が担う。
- **AI の操作**も `GameApi` を呼び出すこと。UI 操作のシミュレーション (pieceChange/panelChange) は禁止。
- コンポーネントは Repository の読み取りを `$derived` で行い、書き込みは `GameApi` または `InteractionService` に委譲する。

### 依存関係ルール

- 依存方向は presentation → api → services → domain → data の一方向。
- api 層は services を内部で呼び出す。presentation 層は api/services を直接呼び出してよいが、逆方向は禁止。
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

## 仕様の所在地 (Canonical Source)

仕様の二重管理を防ぐため、各種情報の正式な所在地を以下に定める。md ファイルに具体的な処理・値・フローは記載しない。

| 種別               | 場所                                            | 備考                                       |
| ------------------ | ----------------------------------------------- | ------------------------------------------ |
| コーディング規約   | `.github/copilot-instructions.md`（本ファイル） |                                            |
| ゲームルール       | `src/lib/api/GameApi.ts` TSDoc + テスト         | 戦闘式・ターンフロー・パッシブ効果等       |
| 定数・ユニット仕様 | `src/lib/domain/` 各ファイルの TSDoc            | PieceType CONFIGS, GameConstants 等        |
| フォルダ構成・層   | `docs/ARCHITECTURE.md`                          | 構成と役割のみ。具体的な処理・値は書かない |

## テスト記述ルール

- テストファイルは対象ファイルの隣にコロケーション配置: `Foo.ts` → `Foo.test.ts`。
- GameApi の新しい操作を追加する場合、テストケース一覧 → レビュー → テストコード + 実装の順で進める (TDD 標準フロー)。
- ゲームルール変更時は、対応する GameApi テストケースの更新を必須とする。
- テストでのゲーム状態セットアップには `GameApi.initializeGame()` を使用する。個別 Repository の直接操作は補助的なセットアップにのみ許可。
- テスト名は仕様書として機能する。入力・条件・期待結果が読み取れる具体的な記述にすること。
- モック（`vi.mock`, `vi.spyOn` 等）は使用禁止。実際の Repository / State を通した結合テストとして記述する。

## 拡張パターン別チェックリスト

### 新ユニットタイプの追加

1. `PieceType` に enum 値と `CONFIGS` エントリを追加。
2. `GameConstants` に関連する閾値があれば追加。
3. `GameApi.test.ts` にユニット固有のテストケースを追加。
4. `messages/*.json` に表示名を追加。

### 新しい GameApi 操作の追加

1. `GameApi.ts` にメソッドシグネチャ + TSDoc 仕様を定義。
2. `types.ts` に必要な ActionError / Result 型を追加。
3. TDD フロー: テストケース一覧 → レビュー → テストコード + 実装。
4. コンポーネント/AI から呼び出しを接続。

### ゲームパラメータの変更

1. `GameConstants.ts` の値を変更。
2. `pnpm test` で既存テストへの影響を確認・修正。

### 新コンポーネントの追加

1. `src/lib/presentation/components/` に配置。
2. ゲーム状態の変更は `GameApi` 経由、UI 状態は `InteractionService` 経由。
3. Repository の読み取りは `$derived` で行う。

## コアファイルと拡張ポイント

### コア (変更時は設計への影響を慎重に検討)

- `src/lib/api/GameApi.ts` — ゲーム操作の契約。
- `src/lib/api/types.ts` — API 型定義。
- `src/lib/domain/entities/*` — データ構造。
- `src/lib/domain/enums/*` — 列挙型。

### 拡張ポイント (安全に変更・追加可能)

- `src/lib/domain/constants/GameConstants.ts` — 数値調整。
- `src/lib/domain/enums/PieceType.ts` の CONFIGS — ユニットパラメータ。
- `src/lib/presentation/components/` — UI 追加。
- `messages/*.json` — 翻訳追加。

## サービス層の構成

詳細は [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) を参照。

| Service                  | 責務                                                        |
| ------------------------ | ----------------------------------------------------------- |
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
