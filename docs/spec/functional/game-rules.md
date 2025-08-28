# ゲームルール（Game Rules）

関連コード:

- ドメインサービス: [src/lib/domain/services/GameRulesService.ts](../../../src/lib/domain/services/GameRulesService.ts)
- 盤面操作: [src/lib/data/services/PanelService.ts](../../../src/lib/data/services/PanelService.ts)
- 盤面状態リポジトリ: [src/lib/data/repositories/PanelRepository.ts](../../../src/lib/data/repositories/PanelRepository.ts)
- 駒関連: [src/lib/data/services/PieceService.ts](../../../src/lib/data/services/PieceService.ts), [src/lib/data/repositories/PieceRepository.ts](../../../src/lib/data/repositories/PieceRepository.ts)

## 盤面（Board）

- 層 layer により六角形グリッドを生成。
  - hl ∈ [-(layer-1), +(layer-1)], vl ∈ [0, layer - |hl|)
- 初期配置
  - SELF 初期拠点: (hl=-(layer-1), vl=0)
  - OPPONENT 初期拠点: (hl=+(layer-1), vl=0)
  - 上記拠点の resource, castle は 5。他は 0。

## 駒（Pieces）

- 種類: KNIGHT, ROOK, BISHOP
- 所有者: SELF / OPPONENT
- 生成位置: 自軍拠点（hl=±(layer-1), vl=0）
- 生成不可条件: 生成位置に既存の駒がある場合

## パネル状態（PanelState）

- UNOCCUPIED: 駒なしの通常マス
- OCCUPIED: 駒が存在
- SELECTED: 選択中のマス
- MOVABLE: 選択中の駒が移動可能
- IMMOVABLE: このターン移動対象外

## 隣接判定（Adjacency）

- PanelPosition.isAdjacent(a,b) で六角グリッドとしての近傍を判定

## ターン（Turn）

- 初期: { num:1, player: SELF }
- nextTurn()
  - SELF -> OPPONENT: 10秒後に AI ターン開始 + タイマー再開
  - OPPONENT -> SELF: ターン数 +1, 10秒後にタイマー再開
  - 自軍の各駒のある Panel に対して
    - BISHOP: resource +1 (max 5)
    - ROOK: castle +1 (max 5)

## 移動/交戦（Move & Combat）

- クリック操作（panelChange）
  - MOVABLE 以外の他人の駒をクリックした場合は無効
  - SELECTED: 変化なし
  - MOVABLE: 実行
    - 目的地に敵駒がいれば、selectedPiece と敵駒を全て除去し、そのマスを自軍 OCCUPIED へ（resource/castle は元SELECTEDの値）
    - 敵駒がいなければ、selectedPiece を目的地へ移動
  - その他: クリックマスを SELECTED にする
- stateChange
  - SELECTED/MOVABLE: 盤面の選択/可否状態をリセット
  - それ以外: クリックマスを SELECTED にし、隣接 UNOCCUPIED を MOVABLE に、その他を IMMOVABLE に

## 勝敗条件（暫定）

- 本リポジトリには明示ルールなし。必要に応じて拡張。
