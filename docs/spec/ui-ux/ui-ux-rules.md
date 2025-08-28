# UI/UX ルール（UI/UX Rules）

関連コード:

- タイマー表示コンポーネント: [src/lib/presentation/components/TurnTimer.svelte](../../../src/lib/presentation/components/TurnTimer.svelte)
- タイマー状態: [src/lib/presentation/state/TimerState.svelte.ts](../../../src/lib/presentation/state/TimerState.svelte.ts)
- 盤面表示（例）: [src/routes/LayeredHexagonPanels.svelte](../../../src/routes/LayeredHexagonPanels.svelte), [src/routes/HexagonPanel.svelte](../../../src/routes/HexagonPanel.svelte)

## タイマー表示

- 残り時間を数値で表示（timerState.getTimeRemaining）
- アクティブでない場合: text-gray-500
- 3秒以下: text-red-600
- それ以外: text-onbackground / dark:text-onbackground-dark
- ボタン: start/stop/reset を提供（デバッグ想定）

## パネル表示（想定）

- PanelState に応じたスタイル
  - UNOCCUPIED: 通常
  - OCCUPIED: 駒アイコンを表示（PieceTypeに応じたIcon）
  - SELECTED: 強調表示
  - MOVABLE: 移動候補の強調
  - IMMOVABLE: 非アクティブスタイル

## クリック操作

- クリックで GameService.panelChange(panelPosition)
- 無効クリックは無視（フィードバックなし）

## レスポンシブ/アクセシビリティ（任意）

- モバイル操作対応、コントラスト/フォントサイズ調整は将来対応
