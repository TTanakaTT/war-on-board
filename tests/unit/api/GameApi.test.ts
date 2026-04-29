import { describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { HomeBaseRepository } from "$lib/data/repositories/HomeBaseRepository";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { Player } from "$lib/domain/enums/Player";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { PieceType } from "$lib/domain/enums/PieceType";
import { ActionError } from "$lib/domain/enums/ActionError";
import type {
  GameActionResult,
  GameStateHistoryEntry,
  GameStateSnapshot,
  TurnEndResult,
} from "$lib/domain/types/api";
import {
  HOME_BASE_INIT_RESOURCE,
  HOME_BASE_INIT_CASTLE,
  PLAYER_INIT_RESOURCE,
  DEFAULT_MAX_PIECES_PER_PANEL,
  PASSIVE_RESOURCE_CAP,
  RESOURCE_THRESHOLD_FOR_GENERATION,
} from "$lib/domain/constants/GameConstants";
import { Panel } from "$lib/domain/entities/Panel";

function snapshotFromRepositories(): GameStateSnapshot {
  const turn = TurnRepository.get();

  return {
    panels: PanelRepository.getAll().map((panel) => {
      const hasPiece = PiecesRepository.getPiecesByPosition(panel.panelPosition).length > 0;

      return {
        panelPosition: {
          horizontalLayer: panel.panelPosition.horizontalLayer,
          verticalLayer: panel.panelPosition.verticalLayer,
        },
        panelState: String(hasPiece ? PanelState.OCCUPIED : PanelState.UNOCCUPIED) as
          | "occupied"
          | "unoccupied",
        player: String(panel.player) as "self" | "opponent" | "unknown",
        resource: panel.resource,
        castle: panel.castle,
      };
    }),
    pieces: PiecesRepository.getAll().map((piece) => ({
      id: piece.id,
      panelPosition: {
        horizontalLayer: piece.panelPosition.horizontalLayer,
        verticalLayer: piece.panelPosition.verticalLayer,
      },
      initialPosition: {
        horizontalLayer: piece.initialPosition.horizontalLayer,
        verticalLayer: piece.initialPosition.verticalLayer,
      },
      targetPosition: piece.targetPosition
        ? {
            horizontalLayer: piece.targetPosition.horizontalLayer,
            verticalLayer: piece.targetPosition.verticalLayer,
          }
        : undefined,
      player: String(piece.player) as "self" | "opponent",
      pieceType: String(piece.pieceType) as "knight" | "rook" | "bishop",
      hp: piece.hp,
      stackCount: piece.stackCount,
      maxHp: piece.maxHp,
    })),
    turn: {
      num: turn.num,
      player: String(turn.player) as "self" | "opponent",
      resources: { ...turn.resources },
      maxPiecesPerPanel: { ...turn.maxPiecesPerPanel },
      generationMode: { ...turn.generationMode },
      winner: turn.winner ? (String(turn.winner) as "self" | "opponent") : null,
    },
    homeBases: HomeBaseRepository.getAll().map((homeBase) => ({
      player: String(homeBase.player) as "self" | "opponent",
      panelPosition: {
        horizontalLayer: homeBase.panelPosition.horizontalLayer,
        verticalLayer: homeBase.panelPosition.verticalLayer,
      },
    })),
    layer: LayerRepository.get(),
  };
}

function expectGameStateToMatchRepositories(gameState: GameStateSnapshot) {
  expect(gameState).toEqual(snapshotFromRepositories());
}

function expectActionSuccessWithSnapshot(
  result: { ok: true; value: GameActionResult } | { ok: false; error: ActionError },
) {
  expect(result.ok).toBe(true);
  if (result.ok) {
    expectGameStateToMatchRepositories(result.value.gameState);
  }
}

function expectTurnEndSuccessWithSnapshot(
  result: { ok: true; value: TurnEndResult } | { ok: false; error: ActionError },
) {
  expect(result.ok).toBe(true);
  if (result.ok) {
    expectGameStateToMatchRepositories(result.value.gameState);
  }
}

function expectHistoryEntryToMatchSnapshot(
  entry: GameStateHistoryEntry,
  expectedSequence: number,
  expectedTurn: number,
  expectedSnapshot: GameStateSnapshot,
) {
  expect(entry.sequence).toBe(expectedSequence);
  expect(entry.capturedAtTurn).toBe(expectedTurn);
  expect(entry.snapshot).toEqual(expectedSnapshot);
}

describe("GameApi.initializeGame", () => {
  describe("board generation", () => {
    test("when layer=4, PanelRepository contains exactly 16 panels (layer^2)", () => {
      GameApi.initializeGame({ layer: 4 });
      expect(PanelRepository.getAll()).toHaveLength(16);
    });

    test("when layer=4, panels where |hl| < layer-1 have resource=0, castle=0, player=UNKNOWN, panelState=UNOCCUPIED", () => {
      GameApi.initializeGame({ layer: 4 });
      const panels = PanelRepository.getAll();
      const normalPanels = panels.filter((p) => Math.abs(p.panelPosition.horizontalLayer) < 3);
      expect(normalPanels.length).toBeGreaterThan(0);
      for (const p of normalPanels) {
        expect(p.resource).toBe(0);
        expect(p.castle).toBe(0);
        expect(p.player).toBe(Player.UNKNOWN);
        expect(p.panelState).toBe(PanelState.UNOCCUPIED);
      }
    });

    test("when layer=4, the panel at hl=-(layer-1) vl=0 has player=SELF, resource=HOME_BASE_INIT_RESOURCE(5), castle=HOME_BASE_INIT_CASTLE(10)", () => {
      GameApi.initializeGame({ layer: 4 });
      const panel = PanelRepository.find(
        new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 }),
      );
      expect(panel).toBeDefined();
      expect(panel!.player).toBe(Player.SELF);
      expect(panel!.resource).toBe(HOME_BASE_INIT_RESOURCE);
      expect(panel!.castle).toBe(HOME_BASE_INIT_CASTLE);
    });

    test("when layer=4, the panel at hl=+(layer-1) vl=0 has player=OPPONENT, resource=HOME_BASE_INIT_RESOURCE(5), castle=HOME_BASE_INIT_CASTLE(10)", () => {
      GameApi.initializeGame({ layer: 4 });
      const panel = PanelRepository.find(
        new PanelPosition({ horizontalLayer: 3, verticalLayer: 0 }),
      );
      expect(panel).toBeDefined();
      expect(panel!.player).toBe(Player.OPPONENT);
      expect(panel!.resource).toBe(HOME_BASE_INIT_RESOURCE);
      expect(panel!.castle).toBe(HOME_BASE_INIT_CASTLE);
    });
  });

  describe("home base registration", () => {
    test("when layer=4, HomeBaseRepository contains SELF at (-3,0) and OPPONENT at (3,0)", () => {
      GameApi.initializeGame({ layer: 4 });
      const homeBases = HomeBaseRepository.getAll();
      expect(homeBases).toHaveLength(2);

      const selfHb = HomeBaseRepository.getByPlayer(Player.SELF);
      expect(selfHb).toBeDefined();
      expect(selfHb!.panelPosition.horizontalLayer).toBe(-3);
      expect(selfHb!.panelPosition.verticalLayer).toBe(0);

      const oppHb = HomeBaseRepository.getByPlayer(Player.OPPONENT);
      expect(oppHb).toBeDefined();
      expect(oppHb!.panelPosition.horizontalLayer).toBe(3);
      expect(oppHb!.panelPosition.verticalLayer).toBe(0);
    });
  });

  describe("layer storage", () => {
    test("when layer=4, LayerRepository.get() returns 4", () => {
      GameApi.initializeGame({ layer: 4 });
      expect(LayerRepository.get()).toBe(4);
    });
  });

  describe("initial turn state", () => {
    test("after init, TurnRepository returns turn.num=1, turn.player=SELF, turn.winner=null", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      expect(turn.num).toBe(1);
      expect(turn.player).toBe(Player.SELF);
      expect(turn.winner).toBeNull();
    });

    test("after init, both players have generationMode='front' and maxPiecesPerPanel=DEFAULT_MAX_PIECES_PER_PANEL(2)", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      expect(turn.generationMode[String(Player.SELF)]).toBe("front");
      expect(turn.generationMode[String(Player.OPPONENT)]).toBe("front");
      expect(turn.maxPiecesPerPanel[String(Player.SELF)]).toBe(DEFAULT_MAX_PIECES_PER_PANEL);
      expect(turn.maxPiecesPerPanel[String(Player.OPPONENT)]).toBe(DEFAULT_MAX_PIECES_PER_PANEL);
    });

    test("after init, SELF resources = PLAYER_INIT_RESOURCE(5) + sum of owned panel resources (home base 5) = 10", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      expect(turn.resources[String(Player.SELF)]).toBe(
        PLAYER_INIT_RESOURCE + HOME_BASE_INIT_RESOURCE,
      );
    });

    test("after init, OPPONENT resources = PLAYER_INIT_RESOURCE(5) because income is not added until their turn starts", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      expect(turn.resources[String(Player.OPPONENT)]).toBe(PLAYER_INIT_RESOURCE);
    });
  });

  describe("pieces", () => {
    test("after init, PieceRepository contains no pieces", () => {
      GameApi.initializeGame({ layer: 4 });
      expect(PiecesRepository.getAll()).toHaveLength(0);
    });
  });

  describe("return value", () => {
    test("initializeGame({ layer: 4 }) returns the post-action game state snapshot", () => {
      const result = GameApi.initializeGame({ layer: 4 });
      expectActionSuccessWithSnapshot(result);
    });

    test("initializeGame({ layer: 4 }) records the initial board snapshot as history sequence 0", () => {
      const result = GameApi.initializeGame({ layer: 4 });
      expectActionSuccessWithSnapshot(result);

      if (!result.ok) return;
      const history = GameApi.getGameStateHistory();
      expect(history).toHaveLength(1);
      expectHistoryEntryToMatchSnapshot(
        history[0],
        0,
        result.value.gameState.turn.num,
        result.value.gameState,
      );
    });
  });

  describe("different layer sizes", () => {
    test("when layer=1, PanelRepository contains exactly 1 panel which is both SELF and OPPONENT home base", () => {
      GameApi.initializeGame({ layer: 1 });
      const panels = PanelRepository.getAll();
      expect(panels).toHaveLength(1);

      const homeBases = HomeBaseRepository.getAll();
      expect(homeBases).toHaveLength(2);
      // Both home bases point to position (0,0)
      expect(homeBases[0].panelPosition.horizontalLayer).toBe(0);
      expect(homeBases[1].panelPosition.horizontalLayer).toBe(0);
    });

    test("when layer=2, PanelRepository contains 4 panels with home bases at hl=-1,vl=0 and hl=1,vl=0", () => {
      GameApi.initializeGame({ layer: 2 });
      const panels = PanelRepository.getAll();
      expect(panels).toHaveLength(4);

      const selfHbPanel = PanelRepository.find(
        new PanelPosition({ horizontalLayer: -1, verticalLayer: 0 }),
      );
      expect(selfHbPanel!.player).toBe(Player.SELF);
      expect(selfHbPanel!.resource).toBe(HOME_BASE_INIT_RESOURCE);
      expect(selfHbPanel!.castle).toBe(HOME_BASE_INIT_CASTLE);

      const oppHbPanel = PanelRepository.find(
        new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 }),
      );
      expect(oppHbPanel!.player).toBe(Player.OPPONENT);
      expect(oppHbPanel!.resource).toBe(HOME_BASE_INIT_RESOURCE);
      expect(oppHbPanel!.castle).toBe(HOME_BASE_INIT_CASTLE);
    });
  });

  describe("re-initialization", () => {
    test("when game has pieces and advanced turns, calling initializeGame again resets PanelRepository, PieceRepository, and TurnRepository to fresh initial state", () => {
      // Setup: initialize and simulate game progress
      GameApi.initializeGame({ layer: 4 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: new PanelPosition({
            horizontalLayer: 0,
            verticalLayer: 0,
          }),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, num: 5 });

      // Act: re-initialize
      GameApi.initializeGame({ layer: 4 });

      // Assert: clean state
      expect(PiecesRepository.getAll()).toHaveLength(0);
      expect(TurnRepository.get().num).toBe(1);
      expect(PanelRepository.getAll()).toHaveLength(16);
    });

    test("calling initializeGame again clears previously recorded history and replaces it with the new initial snapshot", () => {
      GameApi.initializeGame({ layer: 4 });
      const endTurnResult = GameApi.endTurn(Player.SELF);
      expectTurnEndSuccessWithSnapshot(endTurnResult);
      expect(GameApi.getGameStateHistory()).toHaveLength(2);

      const result = GameApi.initializeGame({ layer: 2 });
      expectActionSuccessWithSnapshot(result);

      if (!result.ok) return;
      const history = GameApi.getGameStateHistory();
      expect(history).toHaveLength(1);
      expectHistoryEntryToMatchSnapshot(history[0], 0, 1, result.value.gameState);
    });
  });
});

describe("GameApi.assignMove", () => {
  // Helper: place a piece for SELF at (0,0) with initialPosition=(0,0)
  function setupSelfPieceAt(
    hl: number,
    vl: number,
    id = 1,
    pieceType: PieceType = PieceType.KNIGHT,
  ): Piece {
    const pos = new PanelPosition({ horizontalLayer: hl, verticalLayer: vl });
    const piece = new Piece({
      id,
      panelPosition: pos,
      initialPosition: pos,
      player: Player.SELF,
      pieceType,
    });
    PiecesRepository.add(piece);
    return piece;
  }

  describe("precondition errors", () => {
    test("when winner is already set, returns GAME_ALREADY_OVER", () => {
      GameApi.initializeGame({ layer: 4 });
      setupSelfPieceAt(0, 0);
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner: Player.OPPONENT });

      const result = GameApi.assignMove(
        Player.SELF,
        1,
        new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 }),
      );
      expect(result).toEqual({ ok: false, error: ActionError.GAME_ALREADY_OVER });
    });

    test("when it is OPPONENT's turn but SELF calls assignMove, returns NOT_YOUR_TURN", () => {
      GameApi.initializeGame({ layer: 4 });
      setupSelfPieceAt(0, 0);
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, player: Player.OPPONENT });

      const result = GameApi.assignMove(
        Player.SELF,
        1,
        new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 }),
      );
      expect(result).toEqual({ ok: false, error: ActionError.NOT_YOUR_TURN });
    });

    test("when pieceId does not exist in PiecesRepository, returns PIECE_NOT_FOUND", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.assignMove(
        Player.SELF,
        999,
        new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 }),
      );
      expect(result).toEqual({ ok: false, error: ActionError.PIECE_NOT_FOUND });
    });

    test("when piece exists but belongs to OPPONENT while SELF calls assignMove, returns PIECE_NOT_OWNED", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos,
          initialPosition: pos,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.assignMove(
        Player.SELF,
        1,
        new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 }),
      );
      expect(result).toEqual({ ok: false, error: ActionError.PIECE_NOT_OWNED });
    });

    test("when target is not adjacent to piece's initialPosition, returns TARGET_NOT_REACHABLE", () => {
      GameApi.initializeGame({ layer: 4 });
      setupSelfPieceAt(0, 0);

      // (0,0) -> (2,0) is not adjacent
      const result = GameApi.assignMove(
        Player.SELF,
        1,
        new PanelPosition({ horizontalLayer: 2, verticalLayer: 0 }),
      );
      expect(result).toEqual({ ok: false, error: ActionError.TARGET_NOT_REACHABLE });
    });

    test("when target is a full friendly panel and no resident piece can merge, returns TARGET_NOT_REACHABLE", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 10,
          panelPosition: target,
          initialPosition: target,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 11,
          panelPosition: target,
          initialPosition: target,
          player: Player.SELF,
          pieceType: PieceType.BISHOP,
        }),
      );
      setupSelfPieceAt(0, 0, 1);

      const result = GameApi.assignMove(Player.SELF, 1, target);
      expect(result).toEqual({ ok: false, error: ActionError.TARGET_NOT_REACHABLE });
    });
  });

  describe("successful assignment", () => {
    test("when piece has no targetPosition and target is adjacent, sets piece.targetPosition to target and returns ok", () => {
      GameApi.initializeGame({ layer: 4 });
      setupSelfPieceAt(0, 0);
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });

      const result = GameApi.assignMove(Player.SELF, 1, target);
      expectActionSuccessWithSnapshot(result);

      const updated = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(updated!.targetPosition).toBeDefined();
      expect(updated!.targetPosition!.equals(target)).toBe(true);
    });

    test("when target is a full friendly panel but a resident friendly piece can merge, assignment succeeds", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 10,
          panelPosition: target,
          initialPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 11,
          panelPosition: target,
          initialPosition: target,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      setupSelfPieceAt(0, 0, 1, PieceType.KNIGHT);

      const result = GameApi.assignMove(Player.SELF, 1, target);
      expectActionSuccessWithSnapshot(result);

      const updated = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(updated!.targetPosition?.equals(target)).toBe(true);
    });

    test("when one resident piece exists, two incoming mergeable pieces of the same type can both be assigned to that full panel", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 10,
          panelPosition: target,
          initialPosition: target,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      setupSelfPieceAt(0, 0, 1, PieceType.KNIGHT);
      setupSelfPieceAt(1, 0, 2, PieceType.KNIGHT);

      expectActionSuccessWithSnapshot(GameApi.assignMove(Player.SELF, 1, target));
      expectActionSuccessWithSnapshot(GameApi.assignMove(Player.SELF, 2, target));
    });

    test("when target is empty, two incoming mergeable pieces and one other incoming piece can all be assigned within merged capacity", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      setupSelfPieceAt(0, 0, 1, PieceType.KNIGHT);
      setupSelfPieceAt(1, 0, 2, PieceType.KNIGHT);
      setupSelfPieceAt(-1, 1, 3, PieceType.ROOK);

      expectActionSuccessWithSnapshot(GameApi.assignMove(Player.SELF, 3, target));
      expectActionSuccessWithSnapshot(GameApi.assignMove(Player.SELF, 1, target));
      expectActionSuccessWithSnapshot(GameApi.assignMove(Player.SELF, 2, target));
    });

    test("when target panel has enemy pieces (hasEnemyPresence=true), assignment succeeds regardless of friendly capacity", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      // Place 2 friendly pieces that target (0,1) to fill capacity
      PiecesRepository.add(
        new Piece({
          id: 10,
          panelPosition: target,
          initialPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 11,
          panelPosition: target,
          initialPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      // Place an enemy piece at the target
      PiecesRepository.add(
        new Piece({
          id: 20,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );
      setupSelfPieceAt(0, 0, 1);

      const result = GameApi.assignMove(Player.SELF, 1, target);
      expectActionSuccessWithSnapshot(result);
    });

    test("when target panel has enemy castle > 0 but no enemy pieces, assignment succeeds (enemy presence via wall)", () => {
      GameApi.initializeGame({ layer: 4 });
      // The OPPONENT home base at (3,0) has castle=10 and player=OPPONENT
      // Place a SELF piece adjacent to it at (2,0)
      const pos = new PanelPosition({ horizontalLayer: 2, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos,
          initialPosition: pos,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      const target = new PanelPosition({ horizontalLayer: 3, verticalLayer: 0 });

      const result = GameApi.assignMove(Player.SELF, 1, target);
      expectActionSuccessWithSnapshot(result);
    });

    test("when target equals piece's initialPosition (stay in place), assignment succeeds if capacity allows", () => {
      GameApi.initializeGame({ layer: 4 });
      setupSelfPieceAt(0, 0);
      const stayTarget = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });

      const result = GameApi.assignMove(Player.SELF, 1, stayTarget);
      expectActionSuccessWithSnapshot(result);

      const updated = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(updated!.targetPosition!.equals(stayTarget)).toBe(true);
    });

    test("when piece already has a targetPosition, calling assignMove with a new target overwrites the previous targetPosition", () => {
      GameApi.initializeGame({ layer: 4 });
      setupSelfPieceAt(0, 0);
      const firstTarget = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      const secondTarget = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });

      GameApi.assignMove(Player.SELF, 1, firstTarget);
      const result = GameApi.assignMove(Player.SELF, 1, secondTarget);
      expectActionSuccessWithSnapshot(result);

      const updated = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(updated!.targetPosition!.equals(secondTarget)).toBe(true);
    });
  });
});

describe("GameApi.cancelMove", () => {
  describe("precondition errors", () => {
    test("when winner is already set, returns GAME_ALREADY_OVER", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos,
          initialPosition: pos,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner: Player.OPPONENT });

      const result = GameApi.cancelMove(Player.SELF, 1);
      expect(result).toEqual({ ok: false, error: ActionError.GAME_ALREADY_OVER });
    });

    test("when it is OPPONENT's turn but SELF calls cancelMove, returns NOT_YOUR_TURN", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos,
          initialPosition: pos,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, player: Player.OPPONENT });

      const result = GameApi.cancelMove(Player.SELF, 1);
      expect(result).toEqual({ ok: false, error: ActionError.NOT_YOUR_TURN });
    });

    test("when pieceId does not exist, returns PIECE_NOT_FOUND", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.cancelMove(Player.SELF, 999);
      expect(result).toEqual({ ok: false, error: ActionError.PIECE_NOT_FOUND });
    });

    test("when piece belongs to OPPONENT but SELF calls cancelMove, returns PIECE_NOT_OWNED", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos,
          initialPosition: pos,
          targetPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.cancelMove(Player.SELF, 1);
      expect(result).toEqual({ ok: false, error: ActionError.PIECE_NOT_OWNED });
    });

    test("when piece has no pending targetPosition, returns CANNOT_CANCEL", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos,
          initialPosition: pos,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.cancelMove(Player.SELF, 1);
      expect(result).toEqual({ ok: false, error: ActionError.CANNOT_CANCEL });
    });

    test("when cancelling would cause piece's current panel to exceed maxPiecesPerPanel, returns CANNOT_CANCEL", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      // Fill origin with maxPiecesPerPanel(2) other pieces that stay
      PiecesRepository.add(
        new Piece({
          id: 10,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 11,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.BISHOP,
        }),
      );
      // Piece 1 has been assigned to move away from origin
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.cancelMove(Player.SELF, 1);
      expect(result).toEqual({ ok: false, error: ActionError.CANNOT_CANCEL });
    });

    test("when returning piece merges into an existing stack on a full panel, cancelMove returns ok", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 10,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 11,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.cancelMove(Player.SELF, 1);
      expectActionSuccessWithSnapshot(result);

      const updated = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(updated!.targetPosition).toBeUndefined();
    });
  });

  describe("successful cancellation", () => {
    test("when piece has targetPosition set, cancelMove clears targetPosition to undefined and returns ok", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos,
          initialPosition: pos,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.cancelMove(Player.SELF, 1);
      expectActionSuccessWithSnapshot(result);

      const updated = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(updated!.targetPosition).toBeUndefined();
    });
  });
});

describe("GameApi.generatePiece", () => {
  describe("precondition errors", () => {
    test("when winner is already set, returns GAME_ALREADY_OVER", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner: Player.OPPONENT });

      const result = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      expect(result).toEqual({ ok: false, error: ActionError.GAME_ALREADY_OVER });
    });

    test("when it is OPPONENT's turn but SELF calls generatePiece, returns NOT_YOUR_TURN", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, player: Player.OPPONENT });

      const result = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      expect(result).toEqual({ ok: false, error: ActionError.NOT_YOUR_TURN });
    });

    test("when player resources < pieceType.config.cost, returns INSUFFICIENT_RESOURCES", () => {
      GameApi.initializeGame({ layer: 4 });
      // SELF starts with 10 resources; KNIGHT costs 8, ROOK costs 10
      // Set resources to 0
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 0 } });

      const result = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      expect(result).toEqual({ ok: false, error: ActionError.INSUFFICIENT_RESOURCES });
    });

    test("when no panel meets generation requirements (no owned panel with resource >= RESOURCE_THRESHOLD), returns NO_GENERATION_PANEL", () => {
      GameApi.initializeGame({ layer: 4 });
      // Set home base resource to below threshold
      const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
      const hbPanel = PanelRepository.find(hbPos)!;
      PanelRepository.update(new Panel({ ...hbPanel, resource: 0 }));

      const result = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      expect(result).toEqual({ ok: false, error: ActionError.NO_GENERATION_PANEL });
    });

    test("when all eligible panels are at maxPiecesPerPanel capacity with non-mergeable type, returns NO_GENERATION_PANEL", () => {
      GameApi.initializeGame({ layer: 4 });
      // Fill SELF home base with maxPiecesPerPanel(2) Rooks (non-mergeable)
      const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 10,
          panelPosition: hbPos,
          initialPosition: hbPos,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 11,
          panelPosition: hbPos,
          initialPosition: hbPos,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );

      const result = GameApi.generatePiece(Player.SELF, PieceType.ROOK);
      expect(result).toEqual({ ok: false, error: ActionError.NO_GENERATION_PANEL });
    });
  });

  describe("successful generation", () => {
    test("when SELF has enough resources and home base is available, creates piece on home base and deducts cost from resources", () => {
      GameApi.initializeGame({ layer: 4 });
      const resourcesBefore = TurnRepository.get().resources[String(Player.SELF)];
      const cost = PieceType.KNIGHT.config.cost;

      const result = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      expectActionSuccessWithSnapshot(result);

      const resourcesAfter = TurnRepository.get().resources[String(Player.SELF)];
      expect(resourcesAfter).toBe(resourcesBefore - cost);

      const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
      const pieces = PiecesRepository.getAll().filter((p) => p.panelPosition.equals(hbPos));
      expect(pieces).toHaveLength(1);
    });

    test("after generation, PanelState of the generation panel becomes OCCUPIED", () => {
      GameApi.initializeGame({ layer: 4 });

      GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);

      const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
      const panel = PanelRepository.find(hbPos)!;
      expect(panel.panelState).toBe(PanelState.OCCUPIED);
    });

    test("generated piece has hp equal to pieceType.config.maxHp and belongs to the calling player", () => {
      GameApi.initializeGame({ layer: 4 });

      GameApi.generatePiece(Player.SELF, PieceType.ROOK);

      const pieces = PiecesRepository.getAll();
      expect(pieces).toHaveLength(1);
      expect(pieces[0].player).toBe(Player.SELF);
      expect(pieces[0].hp).toBe(PieceType.ROOK.config.maxHp);
      expect(pieces[0].pieceType).toBe(PieceType.ROOK);
    });

    test("in rear mode, generation prefers home base panel over other eligible panels", () => {
      GameApi.initializeGame({ layer: 4 });
      GameApi.setGenerationMode(Player.SELF, "rear");

      // Make a mid-field panel owned by SELF with enough resource
      const midPos = new PanelPosition({ horizontalLayer: -2, verticalLayer: 0 });
      const midPanel = PanelRepository.find(midPos)!;
      PanelRepository.update(
        new Panel({
          ...midPanel,
          player: Player.SELF,
          resource: RESOURCE_THRESHOLD_FOR_GENERATION,
        }),
      );

      GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);

      // Piece should be on home base (-3,0), not mid-field (-2,0)
      const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
      const pieces = PiecesRepository.getAll();
      expect(pieces).toHaveLength(1);
      expect(pieces[0].panelPosition.equals(hbPos)).toBe(true);
    });
  });
});

describe("GameApi.setGenerationMode", () => {
  describe("precondition errors", () => {
    test("when winner is already set, returns GAME_ALREADY_OVER", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner: Player.OPPONENT });

      const result = GameApi.setGenerationMode(Player.SELF, "front");
      expect(result).toEqual({ ok: false, error: ActionError.GAME_ALREADY_OVER });
    });

    test("when it is OPPONENT's turn but SELF calls setGenerationMode, returns NOT_YOUR_TURN", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, player: Player.OPPONENT });

      const result = GameApi.setGenerationMode(Player.SELF, "front");
      expect(result).toEqual({ ok: false, error: ActionError.NOT_YOUR_TURN });
    });
  });

  describe("successful mode change", () => {
    test("when SELF sets mode to 'front', TurnRepository generationMode for SELF becomes 'front'", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.setGenerationMode(Player.SELF, "front");
      expectActionSuccessWithSnapshot(result);
      expect(TurnRepository.get().generationMode[String(Player.SELF)]).toBe("front");
    });

    test("when SELF sets mode to 'rear', TurnRepository generationMode for SELF stays 'rear'", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.setGenerationMode(Player.SELF, "rear");
      expectActionSuccessWithSnapshot(result);
      expect(TurnRepository.get().generationMode[String(Player.SELF)]).toBe("rear");
    });
  });
});

describe("GameApi.endTurn", () => {
  describe("precondition errors", () => {
    test("when winner is already set, returns GAME_ALREADY_OVER", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner: Player.OPPONENT });

      const result = GameApi.endTurn(Player.SELF);
      expect(result).toEqual({ ok: false, error: ActionError.GAME_ALREADY_OVER });
    });

    test("when it is OPPONENT's turn but SELF calls endTurn, returns NOT_YOUR_TURN", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, player: Player.OPPONENT });

      const result = GameApi.endTurn(Player.SELF);
      expect(result).toEqual({ ok: false, error: ActionError.NOT_YOUR_TURN });
    });
  });

  describe("movement without combat", () => {
    test("when a single piece has targetPosition on an empty panel, piece moves to target and initialPosition is updated", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const piece = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(piece.panelPosition.equals(target)).toBe(true);
      // After turn switch, next player's pieces get resetInitialPositions — this piece belongs to SELF
      // so it was moved during finalize, then OPPONENT's pieces get reset, not SELF's
      // The piece should have been moved to target by finalizePlayerMoves → move()
    });

    test("when a piece has no targetPosition (stays), piece remains at current position after endTurn", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const piece = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(piece.panelPosition.equals(origin)).toBe(true);
    });
  });

  describe("combat - castle-first rule", () => {
    test("when attacker targets a panel with enemy castle > 0, attacker deals attackPowerAgainstWall to castle and stays at origin", () => {
      GameApi.initializeGame({ layer: 4 });
      // OPPONENT home base at (3,0) has castle=10
      const origin = new PanelPosition({ horizontalLayer: 2, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 3, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      // Castle reduced by attackPowerAgainstWall (KNIGHT = 2)
      const panel = PanelRepository.find(target)!;
      expect(panel.castle).toBe(
        HOME_BASE_INIT_CASTLE - PieceType.KNIGHT.config.attackPowerAgainstWall,
      );

      // Attacker stays at origin
      const piece = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(piece.panelPosition.equals(origin)).toBe(true);
      expect(piece.targetPosition).toBeUndefined();
    });

    test("when two attackers target same panel with enemy castle, total wall damage is sum of both attackPowerAgainstWall values", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 3, verticalLayer: 0 });
      const origin1 = new PanelPosition({ horizontalLayer: 2, verticalLayer: 0 });
      // Second attacker also adjacent to (3,0)
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin1,
          initialPosition: origin1,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: origin1,
          initialPosition: origin1,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const panel = PanelRepository.find(target)!;
      expect(panel.castle).toBe(
        HOME_BASE_INIT_CASTLE - PieceType.KNIGHT.config.attackPowerAgainstWall * 2,
      );
    });

    test("when wall is destroyed, overflow piece combat damages both sides and attackers stay if defenders remain", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 1 }));
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const defender = PiecesRepository.getAll().find((p) => p.id === 50)!;
      expect(defender.hp).toBeCloseTo(7.5);

      const piece = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(piece.hp).toBe(
        PieceType.KNIGHT.config.maxHp - PieceType.KNIGHT.config.attackPowerAgainstPiece,
      );
      expect(piece.panelPosition.equals(origin)).toBe(true);
      expect(piece.targetPosition).toBeUndefined();
    });

    test("when overflow damage defeats the last defender, the attacker still takes counterattack and then enters the panel", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 1 }));
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
          hp: 2,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const defender = PiecesRepository.getAll().find((p) => p.id === 50);
      expect(defender).toBeUndefined();

      const attacker = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(attacker.hp).toBe(
        PieceType.KNIGHT.config.maxHp - PieceType.KNIGHT.config.attackPowerAgainstPiece,
      );
      expect(attacker.panelPosition.equals(target)).toBe(true);
      expect(attacker.targetPosition).toBeUndefined();

      const panel = PanelRepository.find(target)!;
      expect(panel.castle).toBe(0);
      expect(panel.player).toBe(Player.SELF);
    });

    test("when overflow defeats a defender, that defender still counterattacks in the same resolution", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 1 }));
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
          hp: 2,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
          hp: 4,
        }),
      );

      GameApi.endTurn(Player.SELF);

      expect(PiecesRepository.getAll().find((p) => p.id === 50)).toBeUndefined();
      expect(PiecesRepository.getAll().find((p) => p.id === 1)).toBeUndefined();

      const panel = PanelRepository.find(target)!;
      expect(panel.castle).toBe(0);
    });
  });

  describe("combat - piece vs piece", () => {
    test("when single attacker targets panel with single defender (castle=0), both take attackPowerAgainstPiece damage simultaneously", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      // KNIGHT vs KNIGHT: both deal 5 AP to each other. HP 10 - 5 = 5. Both survive.
      // Since defender remains, attacker stays at origin.
      const attacker = PiecesRepository.getAll().find((p) => p.id === 1);
      const defender = PiecesRepository.getAll().find((p) => p.id === 50);
      expect(attacker).toBeDefined();
      expect(defender).toBeDefined();
      expect(attacker!.hp).toBe(
        PieceType.KNIGHT.config.maxHp - PieceType.KNIGHT.config.attackPowerAgainstPiece,
      );
      expect(defender!.hp).toBe(
        PieceType.KNIGHT.config.maxHp - PieceType.KNIGHT.config.attackPowerAgainstPiece,
      );
      expect(attacker!.panelPosition.equals(origin)).toBe(true);
    });

    test("when total attacker damage defeats all defenders and attackers survive, they enter the panel", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      // Total defender HP = 2, so both defenders are removed by proportional damage.
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.BISHOP,
          hp: 1,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 51,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.BISHOP,
          hp: 1,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      expect(PiecesRepository.getAll().find((p) => p.id === 50)).toBeUndefined();
      expect(PiecesRepository.getAll().find((p) => p.id === 51)).toBeUndefined();

      const attacker = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(attacker.panelPosition.equals(target)).toBe(true);
    });

    test("when multiple defenders survive, attackers share counter-damage proportionally and stay at origin", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 51,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
          hp: 10,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.BISHOP,
          hp: 5,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const piece1 = PiecesRepository.getAll().find((p) => p.id === 1)!;
      const piece2 = PiecesRepository.getAll().find((p) => p.id === 2)!;
      const defender1 = PiecesRepository.getAll().find((p) => p.id === 50)!;
      const defender2 = PiecesRepository.getAll().find((p) => p.id === 51)!;

      expect(piece1.hp).toBeCloseTo(10 / 3);
      expect(piece2.hp).toBeCloseTo(5 / 3);
      expect(defender1.hp).toBeCloseTo(9);
      expect(defender2.hp).toBeCloseTo(9);
      expect(piece1.panelPosition.equals(origin)).toBe(true);
      expect(piece2.panelPosition.equals(origin)).toBe(true);
    });

    test("multiple attackers split their damage across defenders proportionally", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.ROOK,
          hp: 10,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 51,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
          hp: 10,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.BISHOP,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const rook = PiecesRepository.getAll().find((p) => p.id === 2);
      expect(rook).toBeDefined();
      expect(rook!.hp).toBeCloseTo(16 / 3);

      const bishop = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(bishop).toBeDefined();
      expect(bishop!.hp).toBeCloseTo(8 / 3);

      const defenderA = PiecesRepository.getAll().find((p) => p.id === 50);
      const defenderB = PiecesRepository.getAll().find((p) => p.id === 51);
      expect(defenderA!.hp).toBeCloseTo(9);
      expect(defenderB!.hp).toBeCloseTo(9);
    });
  });

  describe("panel ownership refresh", () => {
    test("after combat, panel with only SELF pieces becomes owned by SELF", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      // Weak defender
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.BISHOP,
          hp: 1,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const panel = PanelRepository.find(target)!;
      expect(panel.player).toBe(Player.SELF);
    });
  });

  describe("victory condition", () => {
    test("when attacker captures opponent's home base panel, endTurn returns winner and sets turn.winner", () => {
      GameApi.initializeGame({ layer: 4 });
      const oppHb = new PanelPosition({ horizontalLayer: 3, verticalLayer: 0 });
      // Remove castle to allow entry
      const hbPanel = PanelRepository.find(oppHb)!;
      PanelRepository.update(new Panel({ ...hbPanel, castle: 0 }));

      const origin = new PanelPosition({ horizontalLayer: 2, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: oppHb,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.endTurn(Player.SELF);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.winner).toBe(Player.SELF);
        expectGameStateToMatchRepositories(result.value.gameState);
      }
      expect(TurnRepository.get().winner).toBe(Player.SELF);
    });
  });

  describe("turn transition", () => {
    test("after SELF ends turn, turn.player switches to OPPONENT", () => {
      GameApi.initializeGame({ layer: 4 });

      GameApi.endTurn(Player.SELF);

      expect(TurnRepository.get().player).toBe(Player.OPPONENT);
    });

    test("turn.num increments only when OPPONENT finishes (SELF turn1 → OPPONENT turn1 → SELF turn2)", () => {
      GameApi.initializeGame({ layer: 4 });

      GameApi.endTurn(Player.SELF);
      expect(TurnRepository.get().num).toBe(1);

      GameApi.endTurn(Player.OPPONENT);
      expect(TurnRepository.get().num).toBe(2);
    });
  });

  describe("passive gains for next player", () => {
    test("KNIGHT on a panel claims ownership — panel.player becomes the knight's owner", () => {
      GameApi.initializeGame({ layer: 4 });
      // Place OPPONENT KNIGHT on a neutral panel
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: pos,
          initialPosition: pos,
          player: Player.OPPONENT,
          pieceType: PieceType.KNIGHT,
        }),
      );

      // SELF ends turn → next player is OPPONENT → passive gains applied for OPPONENT
      GameApi.endTurn(Player.SELF);

      const panel = PanelRepository.find(pos)!;
      expect(panel.player).toBe(Player.OPPONENT);
    });

    test("BISHOP on a panel increases panel.resource by 1 (capped at PASSIVE_RESOURCE_CAP)", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const existingPanel = PanelRepository.find(pos)!;
      PanelRepository.update(
        new Panel({
          ...existingPanel,
          player: Player.OPPONENT,
          resource: PASSIVE_RESOURCE_CAP - 1,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: pos,
          initialPosition: pos,
          player: Player.OPPONENT,
          pieceType: PieceType.BISHOP,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const panel = PanelRepository.find(pos)!;
      expect(panel.resource).toBe(PASSIVE_RESOURCE_CAP);
    });

    test("ROOK on a panel increases panel.castle by 1 (capped at PASSIVE_CASTLE_CAP, never reduces existing values above cap)", () => {
      GameApi.initializeGame({ layer: 4 });
      const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const existingPanel = PanelRepository.find(pos)!;
      PanelRepository.update(new Panel({ ...existingPanel, player: Player.OPPONENT, castle: 0 }));
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: pos,
          initialPosition: pos,
          player: Player.OPPONENT,
          pieceType: PieceType.ROOK,
        }),
      );

      GameApi.endTurn(Player.SELF);

      const panel = PanelRepository.find(pos)!;
      expect(panel.castle).toBe(1);

      // Also verify: home base castle (10) should never be reduced to PASSIVE_CASTLE_CAP(5)
      const hbPos = new PanelPosition({ horizontalLayer: 3, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 51,
          panelPosition: hbPos,
          initialPosition: hbPos,
          player: Player.OPPONENT,
          pieceType: PieceType.ROOK,
        }),
      );

      GameApi.endTurn(Player.OPPONENT);
      // After OPPONENT ends, SELF's passive is applied. But the ROOK is OPPONENT's.
      // We need to check from OPPONENT's perspective. Let's just check the OPPONENT HB after another cycle.
      // Actually after SELF ends turn: OPPONENT gets passive. OPPONENT ROOK on HB → castle = max(10, min(5, 10+1)) = 10
      const hbPanel = PanelRepository.find(hbPos)!;
      expect(hbPanel.castle).toBe(HOME_BASE_INIT_CASTLE);
    });
  });

  describe("resource income", () => {
    test("next player gains resources equal to sum of resource values on all panels they own", () => {
      GameApi.initializeGame({ layer: 4 });
      const oppResourceBefore = TurnRepository.get().resources[String(Player.OPPONENT)];

      GameApi.endTurn(Player.SELF);

      // OPPONENT owns home base (resource=5). Income = 5.
      const oppResourceAfter = TurnRepository.get().resources[String(Player.OPPONENT)];
      expect(oppResourceAfter).toBe(oppResourceBefore + HOME_BASE_INIT_RESOURCE);
    });
  });

  describe("return value", () => {
    test("endTurn returns TurnEndResult with combatOutcomes array, winner, nextPlayer, and gameState", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.endTurn(Player.SELF);
      expectTurnEndSuccessWithSnapshot(result);
      if (!result.ok) return;

      expect(result.value).toHaveProperty("combatOutcomes");
      expect(Array.isArray(result.value.combatOutcomes)).toBe(true);
      expect(result.value).toHaveProperty("winner");
      expect(result.value).toHaveProperty("nextPlayer");
      expect(result.value).toHaveProperty("gameState");
      expect(result.value.winner).toBeNull();
      expect(result.value.nextPlayer).toBe(Player.OPPONENT);
    });
  });
});

describe("GameApi.getMovableTargets", () => {
  test("when pieceId does not exist, returns empty array", () => {
    GameApi.initializeGame({ layer: 4 });

    const targets = GameApi.getMovableTargets(999);
    expect(targets).toEqual([]);
  });

  test("when piece exists, returns adjacent panels that satisfy movement rules plus the piece's own position", () => {
    GameApi.initializeGame({ layer: 4 });
    const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: pos,
        initialPosition: pos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );

    const targets = GameApi.getMovableTargets(1);
    // Should include the piece's own position (stay) and adjacent panels
    expect(targets.length).toBeGreaterThan(0);
    // Own position should be included
    expect(targets.some((t) => t.equals(pos))).toBe(true);
  });

  test("when adjacent friendly panel is full and no resident piece can merge, that panel is excluded from results", () => {
    GameApi.initializeGame({ layer: 4 });
    const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
    const fullPanel = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: pos,
        initialPosition: pos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    // Fill adjacent panel
    PiecesRepository.add(
      new Piece({
        id: 10,
        panelPosition: fullPanel,
        initialPosition: fullPanel,
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 11,
        panelPosition: fullPanel,
        initialPosition: fullPanel,
        player: Player.SELF,
        pieceType: PieceType.BISHOP,
      }),
    );

    const targets = GameApi.getMovableTargets(1);
    expect(targets.some((t) => t.equals(fullPanel))).toBe(false);
  });

  test("when adjacent friendly panel is full but a resident piece can merge, that panel is included in results", () => {
    GameApi.initializeGame({ layer: 4 });
    const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
    const fullPanel = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: pos,
        initialPosition: pos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 10,
        panelPosition: fullPanel,
        initialPosition: fullPanel,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 11,
        panelPosition: fullPanel,
        initialPosition: fullPanel,
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      }),
    );

    const targets = GameApi.getMovableTargets(1);
    expect(targets.some((t) => t.equals(fullPanel))).toBe(true);
  });

  test("when adjacent panel has enemy presence, it is always included regardless of capacity", () => {
    GameApi.initializeGame({ layer: 4 });
    const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
    const enemyPanel = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: pos,
        initialPosition: pos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 50,
        panelPosition: enemyPanel,
        initialPosition: enemyPanel,
        player: Player.OPPONENT,
        pieceType: PieceType.KNIGHT,
      }),
    );

    const targets = GameApi.getMovableTargets(1);
    expect(targets.some((t) => t.equals(enemyPanel))).toBe(true);
  });

  test("when piece's own position (stay) merges within capacity, it is included in results", () => {
    GameApi.initializeGame({ layer: 4 });
    const pos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
    // Fill panel to max with this piece + another
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: pos,
        initialPosition: pos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 2,
        panelPosition: pos,
        initialPosition: pos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    // Piece 3 also stays on the same panel; three Knights collapse into one merged stack.
    PiecesRepository.add(
      new Piece({
        id: 3,
        panelPosition: pos,
        initialPosition: pos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );

    const targets = GameApi.getMovableTargets(3);
    expect(targets.some((t) => t.equals(pos))).toBe(true);
  });
});

describe("GameApi state snapshot contract", () => {
  describe("action responses include the post-action state", () => {
    test("initializeGame returns the full game state snapshot after board setup", () => {
      const result = GameApi.initializeGame({ layer: 4 });
      expectActionSuccessWithSnapshot(result);
    });

    test("assignMove returns the full game state snapshot after targetPosition is updated", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.assignMove(Player.SELF, 1, target);

      expectActionSuccessWithSnapshot(result);
      if (!result.ok) return;
      expect(result.value.gameState.pieces[0].targetPosition).toEqual({
        horizontalLayer: target.horizontalLayer,
        verticalLayer: target.verticalLayer,
      });
    });

    test("cancelMove returns the full game state snapshot after targetPosition is cleared", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      const result = GameApi.cancelMove(Player.SELF, 1);

      expectActionSuccessWithSnapshot(result);
      if (!result.ok) return;
      expect(result.value.gameState.pieces[0].targetPosition).toBeUndefined();
    });

    test("generatePiece returns the full game state snapshot after resources and pieces are updated", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);

      expectActionSuccessWithSnapshot(result);
      if (!result.ok) return;
      expect(result.value.gameState.pieces).toHaveLength(1);
      expect(result.value.gameState.turn.resources[String(Player.SELF)]).toBe(
        PLAYER_INIT_RESOURCE + HOME_BASE_INIT_RESOURCE - PieceType.KNIGHT.config.cost,
      );
    });

    test("setGenerationMode returns the full game state snapshot after generationMode is updated", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.setGenerationMode(Player.SELF, "rear");

      expectActionSuccessWithSnapshot(result);
      if (!result.ok) return;
      expect(result.value.gameState.turn.generationMode[String(Player.SELF)]).toBe("rear");
    });

    test("endTurn returns the full game state snapshot together with combat outcomes and next turn info", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.endTurn(Player.SELF);

      expectTurnEndSuccessWithSnapshot(result);
      if (!result.ok) return;
      expect(result.value.nextPlayer).toBe(Player.OPPONENT);
      expect(result.value.gameState.turn.player).toBe(String(Player.OPPONENT));
    });
  });

  describe("GameApi.getGameState", () => {
    test("getGameStateHistory returns the initial snapshot and appends one entry after a successful endTurn", () => {
      const initResult = GameApi.initializeGame({ layer: 4 });
      expectActionSuccessWithSnapshot(initResult);
      if (!initResult.ok) return;

      const initialHistory = GameApi.getGameStateHistory();
      expect(initialHistory).toHaveLength(1);
      expectHistoryEntryToMatchSnapshot(
        initialHistory[0],
        0,
        initResult.value.gameState.turn.num,
        initResult.value.gameState,
      );

      const endTurnResult = GameApi.endTurn(Player.SELF);
      expectTurnEndSuccessWithSnapshot(endTurnResult);
      if (!endTurnResult.ok) return;

      const history = GameApi.getGameStateHistory();
      expect(history).toHaveLength(2);
      expectHistoryEntryToMatchSnapshot(
        history[1],
        1,
        endTurnResult.value.gameState.turn.num,
        endTurnResult.value.gameState,
      );
    });

    test("getGameStateHistory does not append entries for successful non-endTurn actions", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      expect(GameApi.getGameStateHistory()).toHaveLength(1);
      expectActionSuccessWithSnapshot(
        GameApi.assignMove(
          Player.SELF,
          1,
          new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 }),
        ),
      );
      expect(GameApi.getGameStateHistory()).toHaveLength(1);
    });

    test("getGameStateHistory returns immutable snapshots even if a caller mutates the returned value", () => {
      GameApi.initializeGame({ layer: 4 });

      const historyBeforeMutation = GameApi.getGameStateHistory();
      historyBeforeMutation[0].snapshot.turn.num = 999;
      historyBeforeMutation[0].snapshot.panels[0].resource = 999;

      const historyAfterMutation = GameApi.getGameStateHistory();
      expect(historyAfterMutation[0].sequence).toBe(0);
      expect(historyAfterMutation[0].capturedAtTurn).toBe(1);
      expect(historyAfterMutation[0].snapshot.turn.num).toBe(1);
      expect(historyAfterMutation[0].snapshot.panels[0].resource).not.toBe(999);
    });

    test("returns panels, pieces, turn, homeBases, and layer for an initialized game", () => {
      GameApi.initializeGame({ layer: 4 });

      const gameState = GameApi.getGameState();

      expectGameStateToMatchRepositories(gameState);
      expect(gameState.panels).toHaveLength(16);
      expect(gameState.homeBases).toHaveLength(2);
      expect(gameState.layer).toBe(4);
    });

    test("normalizes panelState so UI highlight states are excluded from the returned game state", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const originalPanel = PanelRepository.find(target)!;
      PanelRepository.update(
        new Panel({
          ...originalPanel,
          panelState: PanelState.SELECTED,
        }),
      );

      const gameState = GameApi.getGameState();
      const panel = gameState.panels.find(
        (candidate) =>
          candidate.panelPosition.horizontalLayer === target.horizontalLayer &&
          candidate.panelPosition.verticalLayer === target.verticalLayer,
      );

      expect(panel?.panelState).toBe(String(PanelState.UNOCCUPIED));
    });

    test("includes pending move targets and generation mode in an in-progress turn", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      GameApi.setGenerationMode(Player.SELF, "rear");

      const gameState = GameApi.getGameState();

      expect(gameState.pieces[0].targetPosition).toEqual({
        horizontalLayer: target.horizontalLayer,
        verticalLayer: target.verticalLayer,
      });
      expect(gameState.turn.generationMode[String(Player.SELF)]).toBe("rear");
    });
  });

  describe("GameApi.loadGameState", () => {
    test("restores a snapshot produced by getGameState into the repositories", () => {
      GameApi.initializeGame({ layer: 4 });
      GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      const snapshot = GameApi.getGameState();

      GameApi.initializeGame({ layer: 2 });

      const result = GameApi.loadGameState(snapshot);

      expectActionSuccessWithSnapshot(result);
      expectGameStateToMatchRepositories(snapshot);
    });

    test("replaces the current game state completely when loading a different snapshot", () => {
      GameApi.initializeGame({ layer: 4 });
      GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      const originalSnapshot = GameApi.getGameState();

      GameApi.initializeGame({ layer: 2 });
      const smallBoardState = GameApi.getGameState();
      expect(smallBoardState.layer).toBe(2);

      GameApi.loadGameState(originalSnapshot);

      expect(GameApi.getGameState()).toEqual(originalSnapshot);
      expect(GameApi.getGameState()).not.toEqual(smallBoardState);
    });

    test("restores a snapshot that contains pending moves and a non-default generation mode", () => {
      GameApi.initializeGame({ layer: 4 });
      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      GameApi.setGenerationMode(Player.SELF, "rear");
      const snapshot = GameApi.getGameState();

      GameApi.initializeGame({ layer: 2 });

      const result = GameApi.loadGameState(snapshot);

      expectActionSuccessWithSnapshot(result);
      const restoredState = GameApi.getGameState();
      expect(restoredState.turn.generationMode[String(Player.SELF)]).toBe("rear");
      expect(restoredState.pieces[0].targetPosition).toEqual({
        horizontalLayer: target.horizontalLayer,
        verticalLayer: target.verticalLayer,
      });
    });

    test("returns INVALID_GAME_STATE when the snapshot is missing one home base", () => {
      GameApi.initializeGame({ layer: 4 });
      const snapshot = GameApi.getGameState();

      const result = GameApi.loadGameState({
        ...snapshot,
        homeBases: snapshot.homeBases.filter((homeBase) => homeBase.player === String(Player.SELF)),
      });

      expect(result).toEqual({ ok: false, error: ActionError.INVALID_GAME_STATE });
    });

    test("accepts a JSON round-tripped snapshot and restores enum-backed values correctly", () => {
      GameApi.initializeGame({ layer: 4 });
      GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      GameApi.setGenerationMode(Player.SELF, "rear");

      const transportedSnapshot = JSON.parse(
        JSON.stringify(GameApi.getGameState()),
      ) as GameStateSnapshot;

      GameApi.initializeGame({ layer: 2 });

      const result = GameApi.loadGameState(transportedSnapshot);

      expectActionSuccessWithSnapshot(result);
      expect(GameApi.getGameState()).toEqual(transportedSnapshot);
    });

    test("normalizes panelState from an imported snapshot so UI-only states are not restored", () => {
      GameApi.initializeGame({ layer: 4 });
      const snapshot = GameApi.getGameState();
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });

      const result = GameApi.loadGameState({
        ...snapshot,
        panels: snapshot.panels.map((panel) =>
          panel.panelPosition.horizontalLayer === target.horizontalLayer &&
          panel.panelPosition.verticalLayer === target.verticalLayer
            ? { ...panel, panelState: "occupied" }
            : panel,
        ),
      });

      expectActionSuccessWithSnapshot(result);
      const restoredPanel = PanelRepository.find(target);
      expect(restoredPanel?.panelState).toBe(PanelState.UNOCCUPIED);
      expect(
        GameApi.getGameState().panels.find(
          (panel) =>
            panel.panelPosition.horizontalLayer === target.horizontalLayer &&
            panel.panelPosition.verticalLayer === target.verticalLayer,
        )?.panelState,
      ).toBe("unoccupied");
    });

    test("returns INVALID_GAME_STATE when a piece references a panel that does not exist", () => {
      GameApi.initializeGame({ layer: 4 });
      GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      const snapshot = GameApi.getGameState();

      const result = GameApi.loadGameState({
        ...snapshot,
        pieces: snapshot.pieces.map((piece, index) =>
          index === 0
            ? {
                ...piece,
                panelPosition: { horizontalLayer: 99, verticalLayer: 99 },
              }
            : piece,
        ),
      });

      expect(result).toEqual({ ok: false, error: ActionError.INVALID_GAME_STATE });
    });
  });

  describe("snapshot round trip", () => {
    test("the snapshot returned by an action matches the state returned by getGameState immediately after the action", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);

      expectActionSuccessWithSnapshot(result);
      if (!result.ok) return;
      expect(result.value.gameState).toEqual(GameApi.getGameState());
    });

    test("a snapshot from getGameState can be loaded and then read back without losing information", () => {
      GameApi.initializeGame({ layer: 4 });
      GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);
      GameApi.setGenerationMode(Player.SELF, "rear");
      const snapshot = GameApi.getGameState();

      GameApi.initializeGame({ layer: 2 });
      GameApi.loadGameState(snapshot);

      expect(GameApi.getGameState()).toEqual(snapshot);
    });
  });
});

describe("GameApi.canGenerate", () => {
  test("when player has enough resources and a generation panel exists, returns true", () => {
    GameApi.initializeGame({ layer: 4 });
    // SELF starts with 10 resources, KNIGHT costs 8, home base has resource=5
    expect(GameApi.canGenerate(Player.SELF, PieceType.KNIGHT)).toBe(true);
  });

  test("when player resources < pieceType cost, returns false", () => {
    GameApi.initializeGame({ layer: 4 });
    const turn = TurnRepository.get();
    TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 0 } });

    expect(GameApi.canGenerate(Player.SELF, PieceType.KNIGHT)).toBe(false);
  });

  test("when no panel meets generation requirements, returns false", () => {
    GameApi.initializeGame({ layer: 4 });
    // Set home base resource below threshold
    const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
    const hbPanel = PanelRepository.find(hbPos)!;
    PanelRepository.update(new Panel({ ...hbPanel, resource: 0 }));

    expect(GameApi.canGenerate(Player.SELF, PieceType.KNIGHT)).toBe(false);
  });

  test("when resources are sufficient but all eligible panels are at max capacity with non-mergeable type, returns false", () => {
    GameApi.initializeGame({ layer: 4 });
    const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
    PiecesRepository.add(
      new Piece({
        id: 10,
        panelPosition: hbPos,
        initialPosition: hbPos,
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 11,
        panelPosition: hbPos,
        initialPosition: hbPos,
        player: Player.SELF,
        pieceType: PieceType.ROOK,
      }),
    );

    expect(GameApi.canGenerate(Player.SELF, PieceType.ROOK)).toBe(false);
  });

  test("when panel is at max capacity but has same-type mergeable piece, canGenerate returns true", () => {
    GameApi.initializeGame({ layer: 4 });
    const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
    PiecesRepository.add(
      new Piece({
        id: 10,
        panelPosition: hbPos,
        initialPosition: hbPos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 11,
        panelPosition: hbPos,
        initialPosition: hbPos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );

    expect(GameApi.canGenerate(Player.SELF, PieceType.KNIGHT)).toBe(true);
  });
});

describe("unit merging", () => {
  const hbPos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
  const midPos = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });

  test("endTurn: two SELF Knights moving to the same panel are merged into one with combined HP and stackCount=2", () => {
    GameApi.initializeGame({ layer: 4 });
    const origin1 = new PanelPosition({ horizontalLayer: -1, verticalLayer: 0 });
    const origin2 = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: origin1,
        initialPosition: origin1,
        targetPosition: midPos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    PiecesRepository.add(
      new Piece({
        id: 2,
        panelPosition: origin2,
        initialPosition: origin2,
        targetPosition: midPos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );

    GameApi.endTurn(Player.SELF);

    const atMid = PiecesRepository.getPiecesByPosition(midPos);
    expect(atMid).toHaveLength(1);
    expect(atMid[0].stackCount).toBe(2);
    expect(atMid[0].hp).toBe(PieceType.KNIGHT.config.maxHp * 2);
    expect(atMid[0].maxHp).toBe(PieceType.KNIGHT.config.maxHp * 2);
  });

  test("endTurn: Knight moving to panel with resident SELF Knight merges after turn ends", () => {
    GameApi.initializeGame({ layer: 4 });
    // Resident Knight already at midPos
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: midPos,
        initialPosition: midPos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    // Moving Knight from origin
    const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });

    // Temporarily set panel at origin to SELF so movement capacity allows it
    const originPanel = PanelRepository.find(origin)!;
    PanelRepository.update(new Panel({ ...originPanel, player: Player.SELF }));

    PiecesRepository.add(
      new Piece({
        id: 2,
        panelPosition: origin,
        initialPosition: origin,
        targetPosition: midPos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );

    GameApi.endTurn(Player.SELF);

    const atMid = PiecesRepository.getPiecesByPosition(midPos);
    expect(atMid).toHaveLength(1);
    expect(atMid[0].stackCount).toBe(2);
  });

  test("endTurn: merged Knight attack power equals config AP + stackCount - 1", () => {
    GameApi.initializeGame({ layer: 4 });
    const moveTarget = new PanelPosition({ horizontalLayer: -1, verticalLayer: 0 });
    // Two SELF Knights both move to moveTarget (empty friendly-ish panel), then merge
    [1, 2].forEach((id) =>
      PiecesRepository.add(
        new Piece({
          id,
          panelPosition: new PanelPosition({
            horizontalLayer: -2,
            verticalLayer: id === 1 ? 0 : 1,
          }),
          initialPosition: new PanelPosition({
            horizontalLayer: -2,
            verticalLayer: id === 1 ? 0 : 1,
          }),
          targetPosition: moveTarget,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      ),
    );

    GameApi.endTurn(Player.SELF);

    const merged = PiecesRepository.getPiecesByPosition(moveTarget)[0];
    expect(merged.stackCount).toBe(2);
    // AP = config(5) + 2 - 1 = 6
    expect(merged.attackPowerAgainstPiece).toBe(
      PieceType.KNIGHT.config.attackPowerAgainstPiece + 1,
    );
    // Wall AP = config(2) + 2 - 1 = 3
    expect(merged.attackPowerAgainstWall).toBe(PieceType.KNIGHT.config.attackPowerAgainstWall + 1);
  });

  test("generatePiece: Knight generated on panel with existing same-player Knight merges immediately", () => {
    GameApi.initializeGame({ layer: 4 });
    // Place existing SELF Knight on home base panel
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: hbPos,
        initialPosition: hbPos,
        player: Player.SELF,
        pieceType: PieceType.KNIGHT,
      }),
    );
    // Give enough resources and ensure home base has resource >= threshold
    const turn = TurnRepository.get();
    TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 50 } });

    GameApi.generatePiece(Player.SELF, PieceType.KNIGHT);

    const atHb = PiecesRepository.getPiecesByPosition(hbPos);
    expect(atHb).toHaveLength(1);
    expect(atHb[0].stackCount).toBe(2);
  });

  test("generatePiece: Bishop generated on panel with existing Bishop does NOT merge (non-mergeable)", () => {
    GameApi.initializeGame({ layer: 4 });
    PiecesRepository.add(
      new Piece({
        id: 1,
        panelPosition: hbPos,
        initialPosition: hbPos,
        player: Player.SELF,
        pieceType: PieceType.BISHOP,
      }),
    );
    const turn = TurnRepository.get();
    TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 50 } });

    GameApi.generatePiece(Player.SELF, PieceType.BISHOP);

    const atHb = PiecesRepository.getPiecesByPosition(hbPos);
    expect(atHb).toHaveLength(2);
    atHb.forEach((p) => expect(p.stackCount).toBe(1));
  });

  test("endTurn: Rooks at same panel after movement do NOT merge (non-mergeable)", () => {
    GameApi.initializeGame({ layer: 4 });
    const moveTarget = new PanelPosition({ horizontalLayer: -1, verticalLayer: 0 });
    [1, 2].forEach((id) =>
      PiecesRepository.add(
        new Piece({
          id,
          panelPosition: new PanelPosition({
            horizontalLayer: -2,
            verticalLayer: id === 1 ? 0 : 1,
          }),
          initialPosition: new PanelPosition({
            horizontalLayer: -2,
            verticalLayer: id === 1 ? 0 : 1,
          }),
          targetPosition: moveTarget,
          player: Player.SELF,
          pieceType: PieceType.ROOK,
        }),
      ),
    );

    GameApi.endTurn(Player.SELF);

    const atTarget = PiecesRepository.getPiecesByPosition(moveTarget);
    // Both Rooks should remain as separate units
    expect(atTarget).toHaveLength(2);
    atTarget.forEach((p) => expect(p.stackCount).toBe(1));
  });
});
