# ターンとAI（Turn & AI）

関連コード:

- ターン/AIサービス: `src/lib/domain/services/TurnAndAiService.ts`
- ゲームルール（移動/生成）: `src/lib/domain/services/GameRulesService.ts`
- ターン/タイマー/レイヤーの状態: `src/lib/data/repositories/{TurnRepository,TimerRepository,LayerRepository}.ts`
- 盤面取得/移動候補: `src/lib/data/services/PanelService.ts`

## ターン進行

- ターン開始: timerState.startTimer()、TURN_TIME_LIMIT=10
- タイムアウト時: GameService.nextTurn()
- nextTurn()
  - SELF → OPPONENT: 1秒遅延後、timer 再開 & doOpponentTurn()
  - OPPONENT → SELF: ターン数+1、1秒遅延後、timer 再開
  - ターン開始時のリソース処理
    - BISHOP: resource +1（最大5）
    - ROOK: castle +1（最大5）

## AIターン（doOpponentTurn）

繰り返し条件: turnState.get().player === OPPONENT

- 相手駒が0
  - PieceType を [KNIGHT, BISHOP, ROOK] からランダム選択して generate()
  - 遅延後に再実行（既定: 1000ms。300ms周期にしたい場合はここを変更）
- 相手駒が1以上
  - ランダムに1駒を選択して panelChange()（選択）
  - 遅延
  - movablePanels を取得し分岐
    - 0件: 同駒をもう一度選択し、ランダム PieceType を generate() → 遅延 → 再実行
    - 1件以上: ランダムな MOVABLE を選び panelChange()（移動） → 遅延 → 再実行

## 300ms周期への変更指針

- doOpponentTurn 内の setTimeout(...) の遅延 1000 を 300 に変更
- timerState（1秒刻みのターンタイマー）はそのままでOK（独立）

## ランダムの実装指針

- PieceType ランダム: const arr=[KNIGHT,BISHOP,ROOK]; arr[Math.floor(Math.random()*arr.length)]
- ピース/パネル選択も同様の一様ランダム
