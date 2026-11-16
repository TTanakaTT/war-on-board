import { describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { Player } from "$lib/domain/enums/Player";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { PieceType } from "$lib/domain/enums/PieceType";
import { ActionError } from "$lib/domain/enums/ActionError";
import { MovementRulesService } from "$lib/services/MovementRulesService";
import { InvariantService } from "$lib/services/InvariantService";
import type { GameStateSnapshot } from "$lib/domain/types/api";

const pos = (horizontalLayer: number, verticalLayer: number) =>
  new PanelPosition({ horizontalLayer, verticalLayer });

const findPiece = (id: number) => PiecesRepository.getAll().find((piece) => piece.id === id)!;

function addPiece(id: number, player: Player, pieceType: PieceType, at: PanelPosition): void {
  PiecesRepository.add(
    new Piece({ id, panelPosition: at, initialPosition: at, player, pieceType, movementPoints: 0 }),
  );
}

/** Ends SELF's turn and the following OPPONENT turn, returning to SELF. */
function passFullRound(): void {
  GameApi.endTurn(Player.SELF);
  GameApi.endTurn(Player.OPPONENT);
}

describe.each([Player.SELF, Player.OPPONENT])("gradual movement (%s)", (player) => {
  const opponent = player === Player.SELF ? Player.OPPONENT : Player.SELF;

  function startAsPlayer(): void {
    GameApi.initializeGame({ layer: 4 });
    TurnRepository.set({ ...TurnRepository.get(), player });
  }

  function endOwnTurn(): void {
    GameApi.endTurn(player);
  }

  function endOpponentTurn(): void {
    GameApi.endTurn(opponent);
  }

  test("a heavy is between its panel and the next one after one turn, and arrives after the second", () => {
    startAsPlayer();
    addPiece(1, player, PieceType.HEAVY, pos(0, 0));

    expect(GameApi.assignMove(player, 1, pos(0, 1)).ok).toBe(true);
    endOwnTurn();
    const inTransit = findPiece(1);
    expect(inTransit.panelPosition.equals(pos(0, 0))).toBe(true);
    expect(inTransit.transitPosition?.equals(pos(0, 1))).toBe(true);
    expect(inTransit.movementPoints).toBe(0.5);

    endOpponentTurn();
    endOwnTurn();
    const arrived = findPiece(1);
    expect(arrived.panelPosition.equals(pos(0, 1))).toBe(true);
    expect(arrived.transitPosition).toBeUndefined();
    expect(arrived.targetPosition).toBeUndefined();
  });

  test("changing the destination while in transit keeps the hop in progress", () => {
    startAsPlayer();
    addPiece(1, player, PieceType.HEAVY, pos(0, 0));
    GameApi.assignMove(player, 1, pos(0, 1));
    endOwnTurn();
    endOpponentTurn();

    expect(GameApi.assignMove(player, 1, pos(0, 2)).ok).toBe(true);
    expect(findPiece(1).transitPosition?.equals(pos(0, 1))).toBe(true);
    expect(findPiece(1).movementPoints).toBe(0.5);

    endOwnTurn();
    const arrived = findPiece(1);
    expect(arrived.panelPosition.equals(pos(0, 1))).toBe(true);
    expect(arrived.targetPosition?.equals(pos(0, 2))).toBe(true);
  });

  test("cancelling while in transit stops at the panel being moved into", () => {
    startAsPlayer();
    addPiece(1, player, PieceType.HEAVY, pos(0, 0));
    GameApi.assignMove(player, 1, pos(0, 2));
    endOwnTurn();
    endOpponentTurn();

    expect(GameApi.cancelMove(player, 1).ok).toBe(true);
    expect(findPiece(1).targetPosition?.equals(pos(0, 1))).toBe(true);
    expect(GameApi.cancelMove(player, 1)).toEqual({ ok: false, error: ActionError.CANNOT_CANCEL });
  });

  test("the enemy can enter the panel being moved into, and the arrival becomes an attack that returns the heavy when it fails", () => {
    startAsPlayer();
    addPiece(1, player, PieceType.HEAVY, pos(0, 0));
    addPiece(2, opponent, PieceType.INFANTRY, pos(0, 2));
    GameApi.assignMove(player, 1, pos(0, 1));
    endOwnTurn();

    expect(GameApi.assignMove(opponent, 2, pos(0, 1)).ok).toBe(true);
    endOpponentTurn();
    expect(findPiece(2).panelPosition.equals(pos(0, 1))).toBe(true);

    endOwnTurn();
    const heavy = findPiece(1);
    expect(heavy.panelPosition.equals(pos(0, 0))).toBe(true);
    expect(heavy.transitPosition).toBeUndefined();
    expect(heavy.targetPosition).toBeUndefined();
    expect(heavy.hp).toBeLessThan(heavy.maxHp);
  });

  test("an attack wound up over two turns cannot be changed or cancelled once it has started", () => {
    startAsPlayer();
    addPiece(1, player, PieceType.HEAVY, pos(0, 0));
    addPiece(2, opponent, PieceType.NOBLE, pos(0, 1));
    expect(GameApi.assignMove(player, 1, pos(0, 1)).ok).toBe(true);
    endOwnTurn();
    expect(findPiece(1).transitPosition).toBeUndefined();
    expect(findPiece(1).movementPoints).toBe(0.5);

    endOpponentTurn();
    expect(GameApi.assignMove(player, 1, pos(1, 0))).toEqual({
      ok: false,
      error: ActionError.INSUFFICIENT_MOVEMENT_POINTS,
    });
    expect(GameApi.cancelMove(player, 1)).toEqual({ ok: false, error: ActionError.CANNOT_CANCEL });

    endOwnTurn();
    expect(PiecesRepository.getAll().some((piece) => piece.id === 2)).toBe(false);
    expect(findPiece(1).panelPosition.equals(pos(0, 1))).toBe(true);
  });

  test("a heavy about to leave keeps its own panel taken this turn, and frees it in the turn it arrives", () => {
    startAsPlayer();
    addPiece(1, player, PieceType.HEAVY, pos(0, 0));
    addPiece(2, player, PieceType.ROOK, pos(0, 0));
    addPiece(3, player, PieceType.NOBLE, pos(1, 0));
    GameApi.assignMove(player, 1, pos(0, 1));

    expect(MovementRulesService.canMoveTo(pos(0, 0), player, 3)).toBe(false);
    endOwnTurn();
    endOpponentTurn();
    expect(MovementRulesService.canMoveTo(pos(0, 0), player, 3)).toBe(true);
  });

  test("a heavy in transit and a same-type heavy on its panel break no invariant", () => {
    startAsPlayer();
    addPiece(1, player, PieceType.HEAVY, pos(0, 0));
    addPiece(2, player, PieceType.HEAVY, pos(1, 0));
    GameApi.assignMove(player, 1, pos(0, 1));
    endOwnTurn();
    PiecesRepository.update(new Piece({ ...findPiece(2), panelPosition: pos(0, 0) }));

    expect(InvariantService.check(GameApi.getGameState())).toEqual([]);
  });
});

describe("regression #93", () => {
  test("a cavalry is not generated on the panel a waiting heavy still occupies", () => {
    const snapshot: GameStateSnapshot = JSON.parse(ISSUE_93_BEFORE_END_TURN);
    snapshot.pieces = snapshot.pieces
      .filter((piece) => piece.id !== 24)
      .map((piece) => (piece.id === 22 ? { ...piece, movementPoints: 0 } : piece));
    snapshot.turn.resources.self = 12 + PieceType.CAVALRY.config.cost;
    expect(GameApi.loadGameState(snapshot).ok).toBe(true);

    // (-3,0) keeps the heavy this turn (plus the incoming rook), and (-4,0) still holds two
    // pieces right now, so no panel can take the cavalry.
    expect(GameApi.generatePiece(Player.SELF, PieceType.CAVALRY)).toEqual({
      ok: false,
      error: ActionError.NO_GENERATION_PANEL,
    });

    passFullRound();
    expect(
      InvariantService.check(GameApi.getGameState()).filter(
        (violation) => violation.type === "piece-capacity-exceeded",
      ),
    ).toEqual([]);
  });
});

const ISSUE_93_BEFORE_END_TURN = `{"panels":[{"panelPosition":{"horizontalLayer":-4,"verticalLayer":0},"panelState":"occupied","player":"self","resource":5,"castle":10},{"panelPosition":{"horizontalLayer":-3,"verticalLayer":0},"panelState":"occupied","player":"self","resource":5,"castle":0},{"panelPosition":{"horizontalLayer":-3,"verticalLayer":1},"panelState":"unoccupied","player":"opponent","resource":1,"castle":0},{"panelPosition":{"horizontalLayer":-2,"verticalLayer":0},"panelState":"unoccupied","player":"self","resource":1,"castle":0},{"panelPosition":{"horizontalLayer":-2,"verticalLayer":1},"panelState":"occupied","player":"opponent","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":-2,"verticalLayer":2},"panelState":"unoccupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":-1,"verticalLayer":0},"panelState":"unoccupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":-1,"verticalLayer":1},"panelState":"unoccupied","player":"opponent","resource":2,"castle":0},{"panelPosition":{"horizontalLayer":-1,"verticalLayer":2},"panelState":"unoccupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":-1,"verticalLayer":3},"panelState":"occupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":0,"verticalLayer":0},"panelState":"unoccupied","player":"opponent","resource":0,"castle":1},{"panelPosition":{"horizontalLayer":0,"verticalLayer":1},"panelState":"unoccupied","player":"self","resource":2,"castle":0},{"panelPosition":{"horizontalLayer":0,"verticalLayer":2},"panelState":"unoccupied","player":"self","resource":1,"castle":0},{"panelPosition":{"horizontalLayer":0,"verticalLayer":3},"panelState":"occupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":0,"verticalLayer":4},"panelState":"unoccupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":1,"verticalLayer":0},"panelState":"unoccupied","player":"opponent","resource":1,"castle":2},{"panelPosition":{"horizontalLayer":1,"verticalLayer":1},"panelState":"unoccupied","player":"self","resource":2,"castle":0},{"panelPosition":{"horizontalLayer":1,"verticalLayer":2},"panelState":"unoccupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":1,"verticalLayer":3},"panelState":"unoccupied","player":"self","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":2,"verticalLayer":0},"panelState":"occupied","player":"self","resource":3,"castle":0},{"panelPosition":{"horizontalLayer":2,"verticalLayer":1},"panelState":"unoccupied","player":"opponent","resource":0,"castle":0},{"panelPosition":{"horizontalLayer":2,"verticalLayer":2},"panelState":"unoccupied","player":"self","resource":0,"castle":1},{"panelPosition":{"horizontalLayer":3,"verticalLayer":0},"panelState":"occupied","player":"self","resource":3,"castle":1},{"panelPosition":{"horizontalLayer":3,"verticalLayer":1},"panelState":"unoccupied","player":"self","resource":0,"castle":5},{"panelPosition":{"horizontalLayer":4,"verticalLayer":0},"panelState":"occupied","player":"opponent","resource":5,"castle":0}],"pieces":[{"id":4,"panelPosition":{"horizontalLayer":-2,"verticalLayer":1},"initialPosition":{"horizontalLayer":-2,"verticalLayer":1},"player":"opponent","pieceType":"infantry","hp":14.75,"stackCount":3,"maxHp":30,"movementPoints":0},{"id":5,"panelPosition":{"horizontalLayer":3,"verticalLayer":0},"initialPosition":{"horizontalLayer":3,"verticalLayer":0},"targetPosition":{"horizontalLayer":2,"verticalLayer":1},"player":"self","pieceType":"rook","hp":10,"stackCount":1,"maxHp":10,"movementPoints":1},{"id":7,"panelPosition":{"horizontalLayer":-1,"verticalLayer":3},"initialPosition":{"horizontalLayer":-1,"verticalLayer":3},"targetPosition":{"horizontalLayer":0,"verticalLayer":3},"player":"self","pieceType":"infantry","hp":19,"stackCount":2,"maxHp":20,"movementPoints":1},{"id":9,"panelPosition":{"horizontalLayer":2,"verticalLayer":0},"initialPosition":{"horizontalLayer":2,"verticalLayer":0},"targetPosition":{"horizontalLayer":2,"verticalLayer":1},"player":"self","pieceType":"archer","hp":37,"stackCount":7,"maxHp":56,"movementPoints":1},{"id":12,"panelPosition":{"horizontalLayer":-4,"verticalLayer":0},"initialPosition":{"horizontalLayer":-4,"verticalLayer":0},"targetPosition":{"horizontalLayer":-3,"verticalLayer":1},"player":"self","pieceType":"noble","hp":5,"stackCount":1,"maxHp":5,"movementPoints":1},{"id":18,"panelPosition":{"horizontalLayer":4,"verticalLayer":0},"initialPosition":{"horizontalLayer":4,"verticalLayer":0},"targetPosition":{"horizontalLayer":3,"verticalLayer":0},"player":"opponent","pieceType":"heavy","hp":80,"stackCount":4,"maxHp":80,"movementPoints":0.5},{"id":19,"panelPosition":{"horizontalLayer":0,"verticalLayer":3},"initialPosition":{"horizontalLayer":0,"verticalLayer":3},"targetPosition":{"horizontalLayer":-1,"verticalLayer":3},"player":"self","pieceType":"infantry","hp":29,"stackCount":3,"maxHp":30,"movementPoints":1},{"id":20,"panelPosition":{"horizontalLayer":4,"verticalLayer":0},"initialPosition":{"horizontalLayer":4,"verticalLayer":0},"player":"opponent","pieceType":"noble","hp":3,"stackCount":1,"maxHp":5,"movementPoints":0},{"id":22,"panelPosition":{"horizontalLayer":-3,"verticalLayer":0},"initialPosition":{"horizontalLayer":-3,"verticalLayer":0},"targetPosition":{"horizontalLayer":-3,"verticalLayer":1},"player":"self","pieceType":"heavy","hp":20,"stackCount":1,"maxHp":20,"movementPoints":0.5},{"id":23,"panelPosition":{"horizontalLayer":-4,"verticalLayer":0},"initialPosition":{"horizontalLayer":-4,"verticalLayer":0},"targetPosition":{"horizontalLayer":-3,"verticalLayer":0},"player":"self","pieceType":"rook","hp":10,"stackCount":1,"maxHp":10,"movementPoints":1},{"id":24,"panelPosition":{"horizontalLayer":-3,"verticalLayer":0},"initialPosition":{"horizontalLayer":-3,"verticalLayer":0},"player":"self","pieceType":"cavalry","hp":12,"stackCount":1,"maxHp":12,"movementPoints":2}],"turn":{"num":20,"player":"self","resources":{"self":12,"opponent":4},"maxPiecesPerPanel":{"self":2,"opponent":2},"generationMode":{"self":"front","opponent":"front"},"winner":null},"homeBases":[{"player":"self","panelPosition":{"horizontalLayer":-4,"verticalLayer":0}},{"player":"opponent","panelPosition":{"horizontalLayer":4,"verticalLayer":0}}],"layer":5}`;
