# ドメインモデル（Domain Model）

この文書はコード構成（アーキテクチャ）観点の仕様です。エンティティ/列挙/サービス/状態ストアの責務と関係を定義します。

関連コード:

- エンティティ: `src/lib/domain/entities/*.ts`
- 列挙: `src/lib/domain/enums/*.ts`
- サービス: `src/lib/domain/services/*.ts`
- データリポジトリ: `src/lib/data/repositories/*.ts`
- プレゼンテーション状態: `src/lib/presentation/state/*.svelte.ts`

## エンティティ

- Panel { panelPosition, panelState, player, resource, castle }
- PanelPosition { horizontalLayer, verticalLayer, equals(), isAdjacent() }
- Piece { id, panelPosition, player, pieceType }
- Turn { num, player }

## 列挙（EnumClass ベース）

- Player: SELF, OPPONENT, UNKNOWN
- PanelState: UNOCCUPIED, OCCUPIED, SELECTED, MOVABLE, IMMOVABLE
- PieceType: KNIGHT, ROOK, BISHOP

## サービス

- PanelsService
  - initialize(layer): Panel[] （初期盤生成）
  - find(panelPosition): Panel | undefined
  - findAdjacentPanels(panelPosition): Panel[]
  - filterMovablePanels(): Panel[]
  - clearSelected(): Panel[]
- PieceService
  - find(panelPosition): Piece | undefined
  - findByPlayer(player): Piece | undefined
  - move(dest, selectedPiece)
- GameService（概要）
  - initialize({layer}) / nextTurn() / doOpponentTurn() / generate() / panelChange() / stateChange()

## 状態ストア（Svelte $state）

- panelsState: initialize/update/remove/getAll/setAll
- piecesState: add/remove/getAll/getByPosition/getPiecesByPlayer/setAll
- selectedPanelState: set/get
- layerState: set/get
- turnState: get/set
- timerState: start/stop/getTimeRemaining/isActive/reset
