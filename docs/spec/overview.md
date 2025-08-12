# 概要（Overview）

War on Board は六角形グリッド上で対戦するターン制戦略ゲームです。SELF（自軍）と OPPONENT（敵軍）が交互に手番を持ち、駒の生成・移動・交戦と、パネル（マス）のリソース管理（resource/castle）を通じて盤面優位を獲得します。

主な要素:

- 層（layer）で決まる六角形の盤面サイズ
- 駒タイプ: KNIGHT, ROOK, BISHOP
- パネル状態: UNOCCUPIED, OCCUPIED, SELECTED, MOVABLE, IMMOVABLE
- ターンとタイマー: 各ターン10秒、0で自動ターン終了

用語:

- Panel/PanelPosition: 盤面マスと座標
- Piece: 駒（player+pieceType+位置）
- Resource/Castle: マスに蓄えられる値（最大5）
