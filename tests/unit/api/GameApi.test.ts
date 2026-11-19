import { describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import {
  HOME_BASE_INIT_CASTLE,
  HOME_BASE_INIT_RESOURCE,
  PLAYER_INIT_RESOURCE,
} from "#lib/domain/config.ts";
import {
  ActionError,
  opponentOf,
  PanelState,
  pieceConfig,
  PieceType,
  Player,
  type GameState,
} from "#lib/domain/model.ts";
import { InvariantService } from "#lib/services/InvariantService.ts";
import {
  MatchStatsRepository,
  PanelRepository,
  PiecesRepository,
  TurnRepository,
} from "#lib/store.svelte.ts";
import {
  add,
  endRound,
  exists,
  fill,
  newGame,
  panel,
  piece,
  pos,
  setPanel,
  setResources,
  setTurn,
  SIDES,
} from "../helpers.ts";

const fail = (error: ActionError) => ({ ok: false, error });
const capacityViolations = () =>
  InvariantService.check(GameApi.getGameState()).filter(
    (v) => v.type === "piece-capacity-exceeded",
  );

describe("initializeGame", () => {
  test("builds the board, home bases and opening income", () => {
    newGame(4);
    expect(PanelRepository.getAll()).toHaveLength(16);
    expect(panel(pos(-3, 0))).toMatchObject({
      player: Player.SELF,
      resource: HOME_BASE_INIT_RESOURCE,
      castle: HOME_BASE_INIT_CASTLE,
    });
    expect(panel(pos(3, 0)).player).toBe(Player.OPPONENT);
    expect(panel(pos(0, 0))).toMatchObject({ player: Player.UNKNOWN, resource: 0, castle: 0 });
    expect(TurnRepository.get()).toMatchObject({ num: 1, player: Player.SELF, winner: null });
    expect(TurnRepository.get().resources).toEqual({
      self: PLAYER_INIT_RESOURCE + HOME_BASE_INIT_RESOURCE,
      opponent: PLAYER_INIT_RESOURCE,
    });
    expect(GameApi.getGameStateHistory()).toHaveLength(1);
  });

  test("a single-layer board has one panel", () => {
    newGame(1);
    expect(PanelRepository.getAll()).toHaveLength(1);
  });

  test("re-initializing resets pieces, turn, history and stats", () => {
    newGame();
    add(1, pos(0, 0));
    GameApi.endTurn(Player.SELF);
    newGame();
    expect(PiecesRepository.getAll()).toEqual([]);
    expect(TurnRepository.get().player).toBe(Player.SELF);
    expect(GameApi.getGameStateHistory()).toHaveLength(1);
    expect(MatchStatsRepository.get().self.totalProducedResources).toBe(
      PLAYER_INIT_RESOURCE + HOME_BASE_INIT_RESOURCE,
    );
  });
});

describe("preconditions", () => {
  const actions = {
    assignMove: (p: Player) => GameApi.assignMove(p, 1, pos(0, 1)),
    cancelMove: (p: Player) => GameApi.cancelMove(p, 1),
    assignRangedAttack: (p: Player) => GameApi.assignRangedAttack(p, 1, pos(0, 2)),
    cancelRangedAttack: (p: Player) => GameApi.cancelRangedAttack(p, 1),
    generatePiece: (p: Player) => GameApi.generatePiece(p, PieceType.INFANTRY),
    setGenerationMode: (p: Player) => GameApi.setGenerationMode(p, "rear"),
    endTurn: (p: Player) => GameApi.endTurn(p),
  };

  test.each(Object.entries(actions))(
    "%s rejects the wrong player and a finished game",
    (_, act) => {
      newGame();
      add(1, pos(0, 0));
      expect(act(Player.OPPONENT)).toEqual(fail(ActionError.NOT_YOUR_TURN));
      setTurn({ winner: Player.SELF });
      expect(act(Player.SELF)).toEqual(fail(ActionError.GAME_ALREADY_OVER));
    },
  );

  test.each(["assignMove", "cancelMove", "assignRangedAttack", "cancelRangedAttack"] as const)(
    "%s rejects enemy and missing pieces",
    (name) => {
      newGame();
      add(1, pos(0, 0), Player.OPPONENT);
      expect(actions[name](Player.SELF)).toEqual(fail(ActionError.PIECE_NOT_OWNED));
      PiecesRepository.setAll([]);
      expect(actions[name](Player.SELF)).toEqual(fail(ActionError.PIECE_NOT_FOUND));
    },
  );
});

describe("assignMove", () => {
  test("accepts targets beyond this turn's reach and rejects off-board ones", () => {
    newGame();
    add(1, pos(0, 0));
    expect(GameApi.assignMove(Player.SELF, 1, pos(2, 1)).ok).toBe(true);
    expect(piece(1).targetPosition).toEqual(pos(2, 1));
    expect(GameApi.assignMove(Player.SELF, 1, pos(9, 9))).toEqual(
      fail(ActionError.TARGET_NOT_REACHABLE),
    );
  });

  test("an idle piece can always be ordered; a pending order needs a full hop to redirect", () => {
    newGame();
    add(1, pos(0, 0), Player.SELF, { movementPoints: 0 });
    expect(GameApi.assignMove(Player.SELF, 1, pos(0, 1)).ok).toBe(true);
    expect(GameApi.assignMove(Player.SELF, 1, pos(1, 0))).toEqual(
      fail(ActionError.INSUFFICIENT_MOVEMENT_POINTS),
    );
  });

  test("a full friendly panel is refused unless the piece merges there", () => {
    newGame();
    fill(pos(0, 1), 10);
    add(1, pos(0, 0));
    expect(GameApi.assignMove(Player.SELF, 1, pos(0, 1))).toEqual(
      fail(ActionError.TARGET_NOT_REACHABLE),
    );
    PiecesRepository.remove(piece(11));
    add(12, pos(0, 1));
    expect(GameApi.assignMove(Player.SELF, 1, pos(0, 1)).ok).toBe(true);
  });

  test("enemy pieces and walls are valid targets, whatever the capacity", () => {
    newGame();
    add(1, pos(0, 0));
    add(2, pos(-1, 0));
    add(3, pos(0, 1), Player.OPPONENT);
    setPanel(pos(1, 0), { player: Player.OPPONENT, castle: 3 });
    expect(GameApi.assignMove(Player.SELF, 1, pos(0, 1)).ok).toBe(true);
    expect(GameApi.assignMove(Player.SELF, 2, pos(0, 0)).ok).toBe(true);
    add(4, pos(1, 1));
    expect(GameApi.assignMove(Player.SELF, 4, pos(1, 0)).ok).toBe(true);
  });

  test("order sequence: highest across both players + 1, renewed on every order", () => {
    newGame();
    add(1, pos(0, 0));
    add(2, pos(2, 0), Player.OPPONENT, { orderSequence: 7 });
    GameApi.assignMove(Player.SELF, 1, pos(0, 1));
    expect(piece(1).orderSequence).toBe(8);
    GameApi.cancelMove(Player.SELF, 1);
    expect(piece(1).orderSequence).toBe(8);
    add(3, pos(-1, 0), Player.SELF, { movementPoints: 1 });
    GameApi.assignMove(Player.SELF, 3, pos(-1, 1));
    expect(piece(3).orderSequence).toBe(9);
    GameApi.assignMove(Player.SELF, 1, pos(9, 9));
    expect(piece(1).orderSequence).toBe(8);
  });
});

describe("cancelMove", () => {
  test("clears the target; refuses without one or when it cancels another order", () => {
    newGame();
    add(1, pos(0, 0));
    expect(GameApi.cancelMove(Player.SELF, 1)).toEqual(fail(ActionError.CANNOT_CANCEL));
    GameApi.assignMove(Player.SELF, 1, pos(0, 1));
    expect(GameApi.cancelMove(Player.SELF, 1).ok).toBe(true);
    expect(piece(1).targetPosition).toBeUndefined();

    add(2, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK });
    add(3, pos(-1, 0), Player.SELF, { pieceType: PieceType.NOBLE });
    GameApi.assignMove(Player.SELF, 1, pos(0, 1));
    GameApi.assignMove(Player.SELF, 3, pos(0, 0));
    expect(GameApi.cancelMove(Player.SELF, 1)).toEqual(fail(ActionError.CANNOT_CANCEL));
  });
});

describe("ranged attacks", () => {
  test("assignRangedAttack needs distance 2..range, a defeatable enemy and no wall", () => {
    newGame();
    add(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
    add(2, pos(-1, 0));
    add(3, pos(0, 1), Player.OPPONENT);
    const assign = (id: number) => GameApi.assignRangedAttack(Player.SELF, id, pos(0, 2));

    expect(GameApi.assignRangedAttack(Player.SELF, 1, pos(0, 1))).toEqual(
      fail(ActionError.TARGET_NOT_REACHABLE),
    );
    expect(assign(1)).toEqual(fail(ActionError.TARGET_NOT_REACHABLE));
    add(4, pos(0, 2), Player.OPPONENT);
    expect(assign(2)).toEqual(fail(ActionError.TARGET_NOT_REACHABLE));
    setPanel(pos(0, 2), { player: Player.OPPONENT, castle: 1 });
    expect(assign(1)).toEqual(fail(ActionError.TARGET_NOT_REACHABLE));
    setPanel(pos(0, 2), { castle: 0 });
    expect(assign(1).ok).toBe(true);
    expect(piece(1).rangedAttackTargetPosition).toEqual(pos(0, 2));
  });

  test("endTurn fires without moving; melee defenders cannot counter", () => {
    newGame();
    add(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
    add(2, pos(0, 2), Player.OPPONENT);
    GameApi.assignRangedAttack(Player.SELF, 1, pos(0, 2));
    GameApi.endTurn(Player.SELF);
    expect(piece(1)).toMatchObject({ panelPosition: pos(0, 0), hp: 8 });
    expect(piece(1).rangedAttackTargetPosition).toBeUndefined();
    expect(piece(2).hp).toBe(10 - (4 - 1));
  });

  test("cancelRangedAttack clears a pending attack; slow pieces cannot cancel", () => {
    newGame();
    add(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
    expect(GameApi.cancelRangedAttack(Player.SELF, 1)).toEqual(fail(ActionError.CANNOT_CANCEL));
    PiecesRepository.update({ ...piece(1), rangedAttackTargetPosition: pos(0, 2) });
    expect(GameApi.cancelRangedAttack(Player.SELF, 1).ok).toBe(true);
    add(2, pos(1, 0), Player.SELF, {
      pieceType: PieceType.HEAVY,
      rangedAttackTargetPosition: pos(1, 2),
    });
    expect(GameApi.cancelRangedAttack(Player.SELF, 2)).toEqual(fail(ActionError.CANNOT_CANCEL));
  });
});

describe("generatePiece", () => {
  test("spends the cost and spawns at full HP on the home base", () => {
    newGame();
    expect(GameApi.generatePiece(Player.SELF, PieceType.INFANTRY).ok).toBe(true);
    const [spawned] = PiecesRepository.getAll();
    expect(spawned).toMatchObject({ panelPosition: pos(-3, 0), player: Player.SELF, hp: 10 });
    expect(panel(pos(-3, 0)).panelState).toBe(PanelState.OCCUPIED);
    expect(TurnRepository.get().resources.self).toBe(10 - pieceConfig(PieceType.INFANTRY).cost);
  });

  test("fails without resources or a panel with room", () => {
    newGame();
    setResources(Player.SELF, 1);
    expect(GameApi.generatePiece(Player.SELF, PieceType.INFANTRY)).toEqual(
      fail(ActionError.INSUFFICIENT_RESOURCES),
    );
    expect(GameApi.canGenerate(Player.SELF, PieceType.INFANTRY)).toBe(false);
    setResources(Player.SELF, 100);
    fill(pos(-3, 0), 10);
    expect(GameApi.generatePiece(Player.SELF, PieceType.NOBLE)).toEqual(
      fail(ActionError.NO_GENERATION_PANEL),
    );
    expect(GameApi.canGenerate(Player.SELF, PieceType.NOBLE)).toBe(false);
  });

  test("mergeable types merge into a same-type piece; non-mergeable ones need room", () => {
    newGame();
    setResources(Player.SELF, 100);
    add(1, pos(-3, 0));
    add(2, pos(-3, 0), Player.SELF, { pieceType: PieceType.ROOK });
    expect(GameApi.canGenerate(Player.SELF, PieceType.INFANTRY)).toBe(true);
    expect(GameApi.generatePiece(Player.SELF, PieceType.INFANTRY).ok).toBe(true);
    expect(piece(1).stackCount).toBe(2);
    expect(GameApi.generatePiece(Player.SELF, PieceType.ROOK)).toEqual(
      fail(ActionError.NO_GENERATION_PANEL),
    );
  });

  test("setGenerationMode stores the mode per player", () => {
    newGame();
    GameApi.setGenerationMode(Player.SELF, "rear");
    expect(TurnRepository.get().generationMode).toEqual({ self: "rear", opponent: "front" });
  });
});

describe.each(SIDES)("endTurn (%s)", (player) => {
  const enemy = opponentOf(player);
  const start = () => newGame(4, player);

  test("moves pieces, spends a hop and refills it on the next own turn", () => {
    start();
    add(1, pos(0, 0), player);
    GameApi.assignMove(player, 1, pos(0, 1));
    GameApi.endTurn(player);
    expect(piece(1)).toMatchObject({ panelPosition: pos(0, 1), movementPoints: 0 });
    expect(piece(1).targetPosition).toBeUndefined();
    GameApi.endTurn(enemy);
    expect(piece(1).movementPoints).toBe(1);
  });

  test("walks a distant target one panel per turn", () => {
    start();
    add(1, pos(-2, 0), player);
    GameApi.assignMove(player, 1, pos(1, 0));
    endRound(player);
    endRound(player);
    expect(piece(1).targetPosition).toEqual(pos(1, 0));
    GameApi.endTurn(player);
    expect(piece(1).panelPosition).toEqual(pos(1, 0));
  });

  test("attackers hit the wall first and stay", () => {
    start();
    setPanel(pos(0, 1), { player: enemy, castle: 3 });
    add(1, pos(0, 0), player);
    add(2, pos(-1, 0), player);
    GameApi.assignMove(player, 1, pos(0, 1));
    GameApi.assignMove(player, 2, pos(0, 1));
    const result = GameApi.endTurn(player);
    expect(panel(pos(0, 1)).castle).toBe(1);
    expect(piece(1).panelPosition).toEqual(pos(0, 0));
    expect(result.ok && result.value.combatOutcomes).toEqual([
      { targetPosition: pos(0, 1), destroyedPieceIds: [], entered: false, wallDamageDealt: 2 },
    ]);
  });

  test("wall overflow scales attacker damage; defenders counter in full", () => {
    start();
    setPanel(pos(0, 1), { player: enemy, castle: 0.5 });
    add(1, pos(0, 0), player);
    add(2, pos(0, 1), enemy);
    GameApi.assignMove(player, 1, pos(0, 1));
    GameApi.endTurn(player);
    expect(piece(2).hp).toBe(10 - 4 * 0.5);
    expect(piece(1)).toMatchObject({ hp: 6, panelPosition: pos(0, 0) });
  });

  test("piece combat is simultaneous; winners enter and claim the panel", () => {
    start();
    add(1, pos(0, 0), player);
    add(2, pos(0, 1), enemy);
    GameApi.assignMove(player, 1, pos(0, 1));
    GameApi.endTurn(player);
    expect([piece(1).hp, piece(2).hp]).toEqual([6, 6]);

    add(3, pos(-1, 0), player, { pieceType: PieceType.CAVALRY });
    GameApi.endTurn(enemy);
    GameApi.assignMove(player, 3, pos(0, 1));
    GameApi.endTurn(player);
    expect(exists(2)).toBe(false);
    expect(piece(3).panelPosition).toEqual(pos(0, 1));
    expect(panel(pos(0, 1)).player).toBe(player);
    expect(MatchStatsRepository.get()[enemy].deadUnitCounts.infantry).toBe(1);
  });

  test("capturing the enemy home base wins", () => {
    start();
    const enemyHome = player === Player.SELF ? pos(3, 0) : pos(-3, 0);
    setPanel(enemyHome, { castle: 0 });
    add(1, player === Player.SELF ? pos(2, 0) : pos(-2, 0), player);
    GameApi.assignMove(player, 1, enemyHome);
    const result = GameApi.endTurn(player);
    expect(result.ok && result.value).toMatchObject({ winner: player, nextPlayer: undefined });
    expect(TurnRepository.get().winner).toBe(player);
    expect(GameApi.getGameStateHistory().at(-1)!.snapshot.turn.winner).toBe(player);
  });

  test("passes the turn, then applies passives and income for the next player", () => {
    start();
    setPanel(pos(0, 0), { resource: 4 });
    setPanel(pos(0, 1), { castle: 4 });
    setPanel(pos(1, 0), { castle: 7 });
    add(1, pos(0, 0), enemy, { pieceType: PieceType.NOBLE });
    add(2, pos(0, 1), enemy, { pieceType: PieceType.ROOK });
    add(3, pos(1, 0), enemy, { pieceType: PieceType.ROOK });
    add(4, pos(0, 2), enemy);
    const before = TurnRepository.get();

    GameApi.endTurn(player);
    const turn = TurnRepository.get();
    expect(turn.player).toBe(enemy);
    expect(turn.num).toBe(player === Player.OPPONENT ? before.num + 1 : before.num);
    expect(panel(pos(0, 0)).resource).toBe(5);
    expect(panel(pos(0, 1)).castle).toBe(5);
    expect(panel(pos(1, 0)).castle).toBe(7);
    expect(panel(pos(0, 2)).player).toBe(enemy);
    const income = PanelRepository.getAll()
      .filter((p) => p.player === enemy)
      .reduce((sum, p) => sum + p.resource, 0);
    expect(turn.resources[enemy]).toBe(before.resources[enemy] + income);
    expect(MatchStatsRepository.get()[enemy].totalBuiltCastle).toBe(HOME_BASE_INIT_CASTLE + 1);
  });

  test("same-type pieces meeting on a panel merge", () => {
    start();
    add(1, pos(0, 0), player);
    add(2, pos(0, 2), player);
    for (const id of [1, 2]) GameApi.assignMove(player, id, pos(0, 1));
    GameApi.endTurn(player);
    expect(piece(1)).toMatchObject({ stackCount: 2, hp: 20, maxHp: 20 });
    expect(exists(2)).toBe(false);
  });

  test("non-mergeable attackers capturing a panel never exceed its capacity", () => {
    start();
    setPanel(pos(0, 1), { player: enemy });
    add(10, pos(0, 1), enemy, { pieceType: PieceType.NOBLE, hp: 1 });
    [pos(0, 0), pos(-1, 1), pos(1, 1)].forEach((origin, i) =>
      add(i + 1, origin, player, { pieceType: PieceType.ROOK }),
    );
    for (const id of [1, 2, 3]) expect(GameApi.assignMove(player, id, pos(0, 1)).ok).toBe(true);
    GameApi.endTurn(player);
    expect(PiecesRepository.getPiecesByPosition(pos(0, 1))).toHaveLength(2);
    expect(piece(3).panelPosition).toEqual(pos(1, 1));
    expect(capacityViolations()).toEqual([]);
  });

  test("two pieces heading to the same distant target split around a busy panel", () => {
    start();
    add(1, pos(-1, 0), player, { pieceType: PieceType.ROOK });
    add(2, pos(-1, 0), player, { pieceType: PieceType.NOBLE });
    add(3, pos(0, 0), player);
    GameApi.assignMove(player, 1, pos(1, 0));
    GameApi.assignMove(player, 2, pos(1, 0));
    GameApi.endTurn(player);
    expect(piece(1).panelPosition).toEqual(pos(0, 0));
    expect(piece(2).panelPosition).toEqual(pos(0, 1));
    expect(capacityViolations()).toEqual([]);
  });
});

describe.each(SIDES)("slow pieces (%s)", (player) => {
  const enemy = opponentOf(player);
  const start = () => {
    newGame(4, player);
    add(1, pos(0, 0), player, { pieceType: PieceType.HEAVY });
  };

  test("a heavy is in transit after one turn and arrives after the second", () => {
    start();
    expect(GameApi.assignMove(player, 1, pos(0, 1)).ok).toBe(true);
    GameApi.endTurn(player);
    expect(piece(1)).toMatchObject({
      panelPosition: pos(0, 0),
      transitPosition: pos(0, 1),
      movementPoints: 0.5,
    });
    GameApi.endTurn(enemy);
    expect(GameApi.getMovableTargets(1)).toContainEqual(pos(0, 2));
    GameApi.endTurn(player);
    expect(piece(1).panelPosition).toEqual(pos(0, 1));
    expect(piece(1).transitPosition).toBeUndefined();
  });

  test("in transit, a new destination keeps the hop and cancelling stops at the hop", () => {
    start();
    GameApi.assignMove(player, 1, pos(0, 2));
    GameApi.endTurn(player);
    GameApi.endTurn(enemy);
    expect(GameApi.assignMove(player, 1, pos(1, 1)).ok).toBe(true);
    expect(piece(1)).toMatchObject({ transitPosition: pos(0, 1), movementPoints: 0.5 });
    expect(GameApi.cancelMove(player, 1).ok).toBe(true);
    expect(piece(1).targetPosition).toEqual(pos(0, 1));
    expect(GameApi.cancelMove(player, 1)).toEqual(fail(ActionError.CANNOT_CANCEL));
  });

  test("an enemy entering the hop turns the arrival into an attack; a failed one returns", () => {
    start();
    add(2, pos(0, 2), enemy);
    GameApi.assignMove(player, 1, pos(0, 1));
    GameApi.endTurn(player);
    GameApi.assignMove(enemy, 2, pos(0, 1));
    GameApi.endTurn(enemy);
    GameApi.endTurn(player);
    expect(piece(1)).toMatchObject({ panelPosition: pos(0, 0), transitPosition: undefined });
    expect(piece(1).targetPosition).toBeUndefined();
    expect(piece(1).hp).toBeLessThan(piece(1).maxHp);
  });

  test("a wound-up attack is locked, then resolves", () => {
    start();
    add(2, pos(0, 1), enemy, { pieceType: PieceType.NOBLE });
    GameApi.assignMove(player, 1, pos(0, 1));
    GameApi.endTurn(player);
    GameApi.endTurn(enemy);
    expect(GameApi.getMovableTargets(1)).toEqual([]);
    expect(GameApi.assignMove(player, 1, pos(1, 0))).toEqual(
      fail(ActionError.INSUFFICIENT_MOVEMENT_POINTS),
    );
    expect(GameApi.cancelMove(player, 1)).toEqual(fail(ActionError.CANNOT_CANCEL));
    GameApi.endTurn(player);
    expect(exists(2)).toBe(false);
    expect(piece(1).panelPosition).toEqual(pos(0, 1));
  });

  test("a heavy in transit next to a same-type heavy breaks no invariant", () => {
    start();
    add(2, pos(1, 0), player, { pieceType: PieceType.HEAVY });
    GameApi.assignMove(player, 1, pos(0, 1));
    GameApi.endTurn(player);
    PiecesRepository.update({ ...piece(2), panelPosition: pos(0, 0) });
    expect(InvariantService.check(GameApi.getGameState())).toEqual([]);
  });
});

describe("getMovableTargets", () => {
  test("adjacent panels with room plus staying", () => {
    newGame();
    add(1, pos(0, 0));
    fill(pos(1, 0), 10);
    expect(GameApi.getMovableTargets(1)).toEqual([pos(-1, 0), pos(0, 1), pos(0, 0)]);
    expect(GameApi.getMovableTargets(99)).toEqual([]);
  });
});

describe("state snapshots", () => {
  test("getGameState is plain JSON with highlight states dropped", () => {
    newGame();
    add(1, pos(0, 0), Player.SELF, { targetPosition: pos(0, 1), orderSequence: 1 });
    setPanel(pos(1, 0), { panelState: PanelState.MOVABLE });
    const state = GameApi.getGameState();
    const stateAt = (h: number, v: number) =>
      state.panels.find(
        (p) => p.panelPosition.horizontalLayer === h && p.panelPosition.verticalLayer === v,
      )!.panelState;
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(stateAt(1, 0)).toBe(PanelState.UNOCCUPIED);
    expect(stateAt(0, 0)).toBe(PanelState.OCCUPIED);
  });

  test("loadGameState round-trips a JSON snapshot", () => {
    newGame();
    add(1, pos(0, 0), Player.SELF, {
      targetPosition: pos(0, 1),
      rangedAttackTargetPosition: pos(0, 2),
      transitPosition: pos(0, 1),
      orderSequence: 3,
    });
    GameApi.setGenerationMode(Player.SELF, "rear");
    const saved = JSON.parse(JSON.stringify(GameApi.getGameState()));
    newGame(2);
    expect(GameApi.loadGameState(saved).ok).toBe(true);
    expect(GameApi.getGameState()).toEqual(saved);
  });

  test.each<[string, (s: GameState) => void]>([
    ["a missing home base", (s) => s.homeBases.pop()],
    ["a piece off the board", (s) => (s.pieces[0].panelPosition = pos(9, 9))],
    ["a transit position off the board", (s) => (s.pieces[0].transitPosition = pos(9, 9))],
    ["a ranged target off the board", (s) => (s.pieces[0].rangedAttackTargetPosition = pos(9, 9))],
    ["a zero order sequence", (s) => (s.pieces[0].orderSequence = 0)],
    ["a fractional order sequence", (s) => (s.pieces[0].orderSequence = 1.5)],
    ["hp above maxHp", (s) => (s.pieces[0].hp = 99)],
    ["an unknown generation mode", (s) => (s.turn.generationMode.self = "side" as never)],
  ])("loadGameState rejects %s", (_, corrupt) => {
    newGame();
    add(1, pos(0, 0));
    const snapshot = GameApi.getGameState();
    corrupt(snapshot);
    expect(GameApi.loadGameState(snapshot)).toEqual(fail(ActionError.INVALID_GAME_STATE));
  });

  test("history grows only on endTurn and is returned as a copy", () => {
    newGame();
    add(1, pos(0, 0));
    GameApi.assignMove(Player.SELF, 1, pos(0, 1));
    expect(GameApi.getGameStateHistory()).toHaveLength(1);
    GameApi.endTurn(Player.SELF);
    const history = GameApi.getGameStateHistory();
    expect(history.map((e) => e.sequence)).toEqual([0, 1]);
    history[1].snapshot.turn.num = 999;
    expect(GameApi.getGameStateHistory()[1].snapshot.turn.num).toBe(1);
  });

  test.each(SIDES)("history entries keep the stats at capture time (%s)", (player) => {
    newGame(4, player);
    const atStart = MatchStatsRepository.get();
    expect(GameApi.getGameStateHistory()[0].stats).toEqual(atStart);

    MatchStatsRepository.addDeadUnits(player, PieceType.INFANTRY, 1);
    GameApi.endTurn(player);
    const afterEndTurn = MatchStatsRepository.get();
    expect(afterEndTurn[player].deadUnitCounts[PieceType.INFANTRY]).toBe(1);
    expect(GameApi.getGameStateHistory()[1].stats).toEqual(afterEndTurn);

    MatchStatsRepository.addBuiltCastle(player, 5);
    const history = GameApi.getGameStateHistory();
    expect(history[0].stats).toEqual(atStart);
    expect(history[1].stats).toEqual(afterEndTurn);
  });

  test("withTemporaryGameState restores state, history and stats", () => {
    newGame();
    add(1, pos(0, 0));
    const before = GameApi.getGameState();
    const stats = MatchStatsRepository.get();
    const result = GameApi.withTemporaryGameState(before, () => {
      GameApi.endTurn(Player.SELF);
      throw new Error("boom");
    });
    expect(result).toEqual(fail(ActionError.TEMPORARY_GAME_STATE_CALLBACK_FAILED));
    expect(GameApi.getGameState()).toEqual(before);
    expect(GameApi.getGameStateHistory()).toHaveLength(1);
    expect(MatchStatsRepository.get()).toEqual(stats);

    const value = GameApi.withTemporaryGameState(before, () => GameApi.endTurn(Player.SELF).ok);
    expect(value).toEqual({ ok: true, value: true });
    expect(GameApi.withTemporaryGameState({ ...before, homeBases: [] }, () => 1)).toEqual(
      fail(ActionError.INVALID_GAME_STATE),
    );
  });
});
