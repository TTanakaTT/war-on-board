# War on Board

SvelteKit + Svelte 5 のヘックス盤ターン制ストラテジー。ユーザーへの応答・説明は日本語で行う。

コマンド: `pnpm check`（型）/ `pnpm test`（unit）/ `pnpm lint`・`pnpm format` / `pnpm build`（Paraglide 生成物も更新）

## 構成（src/lib）

- `domain/config.ts` ユニット性能・コスト・初期値などのバランス値。**人間が調整する領域。依頼がない限り値を変えない**
- `domain/model.ts` 型・定数（Player, PieceType, PanelState, ActionError…）と位置/駒ヘルパー。状態はすべて JSON 互換のプレーンデータ
- `domain/types.ts` 対局制御・統計・履歴・不変条件の型
- `store.svelte.ts` 全リアクティブ状態（`XxxRepository`）。値はイミュータブル: 取得した値を変更せず置き換える
- `api/GameApi.ts` ゲーム状態を変える唯一の入口（冒頭コメントがルール概要）。UI/CPU は `GameApiClient` 経由で呼ぶ
- `services/` MovementRules（ターン終了時の移動計画）, Piece（ターン終了処理）, Combat, Generation, Panel（盤・経路）, Interaction（盤クリック）, Match（対局・CPU 自動進行）, AiService + `ai/`, Invariant/DebugMode（dev 専用監視）, MatchHistory
- `presentation/` Svelte コンポーネント, `labels.ts`（表示名）, `layout.ts`（盤座標・UI 寸法）, `icons.ts`
- `tests/unit` vitest（`helpers.ts` を使う）。`tests/simulation` AI 対戦で不変条件を検査（CI の main のみ）

## ルール

- ゲーム状態の変更は GameApi 経由のみ。UI 状態（選択・ダイアログ等）は store を直接更新してよい
- プレイヤー対称性: ルール処理は SELF/OPPONENT を同一コードパスで扱い、特定プレイヤーをハードコードしない（オンライン対戦のため）。テストは `describe.each(SIDES)` で両者を検証
- 表示文言は Paraglide: `messages/{ja,en}.json` にキー追加 → `pnpm build` → `import { m } from "#lib/paraglide/messages.js"` の `m.key()`。dev 専用のデバッグ UI は英語直書き
- スタイルは Tailwind のみ（`<style>` 禁止）。色は `app.css` の `@theme` の `--color-*` を使う（直書き禁止）。寸法などのマジックナンバーは定数化
- コメントは非自明な理由だけを短く書く。仕様をコメントに書き写さない
- テストは domain/services/api が対象。1 ルール 1 テスト程度に絞る。AI の判断内容は詳細にテストしない

## 用語（日本語 = コード。表示名の各語はコードの語に対応させ、en 表示もコードと同じ語を使う）

対局=match, 自軍/敵軍=SELF/OPPONENT, 手番=turn.player, 操作=controller(human/cpu), CPUのLv.=AiStrength, 盤の大きさ=layer, パネル=Panel, 本拠地=HomeBase, 資源=resource, 防壁=wall, 駒/ユニット=Piece, 歩兵=infantry, 貴族=noble, ルーク=rook, 弓兵=archer, 騎兵=cavalry, 重装=heavy, 攻囲兵器=siege, 防御力=defense, 移動力=movement, 攻撃射程=attackRange, マージ数=stackCount, 生産=generatePiece, 生産方式=generationMode(front/rear), 移動中=transitPosition, 操作順=orderSequence, 戦力=armyPower, 総獲得資源=totalGainedResources, 総建築防壁=totalBuiltWall, 合計防壁=totalWall, 占領パネル=occupiedPanels, 死亡戦力=lostArmyPower, 死亡数=lostUnitCounts
