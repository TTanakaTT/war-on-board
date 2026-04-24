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
import {
  HOME_BASE_INIT_RESOURCE,
  HOME_BASE_INIT_CASTLE,
  PLAYER_INIT_RESOURCE,
  DEFAULT_MAX_PIECES_PER_PANEL,
  PASSIVE_RESOURCE_CAP,
  RESOURCE_THRESHOLD_FOR_GENERATION,
} from "$lib/domain/constants/GameConstants";
import { Panel } from "$lib/domain/entities/Panel";

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

    test("after init, both players have generationMode='rear' and maxPiecesPerPanel=DEFAULT_MAX_PIECES_PER_PANEL(2)", () => {
      GameApi.initializeGame({ layer: 4 });
      const turn = TurnRepository.get();
      expect(turn.generationMode[String(Player.SELF)]).toBe("rear");
      expect(turn.generationMode[String(Player.OPPONENT)]).toBe("rear");
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
    test("initializeGame({ layer: 4 }) returns { ok: true, value: undefined }", () => {
      const result = GameApi.initializeGame({ layer: 4 });
      expect(result).toEqual({ ok: true, value: undefined });
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
      expect(result).toEqual({ ok: true, value: undefined });

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
      expect(result).toEqual({ ok: true, value: undefined });

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

      expect(GameApi.assignMove(Player.SELF, 1, target)).toEqual({ ok: true, value: undefined });
      expect(GameApi.assignMove(Player.SELF, 2, target)).toEqual({ ok: true, value: undefined });
    });

    test("when target is empty, two incoming mergeable pieces and one other incoming piece can all be assigned within merged capacity", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 0, verticalLayer: 1 });
      setupSelfPieceAt(0, 0, 1, PieceType.KNIGHT);
      setupSelfPieceAt(1, 0, 2, PieceType.KNIGHT);
      setupSelfPieceAt(-1, 1, 3, PieceType.ROOK);

      expect(GameApi.assignMove(Player.SELF, 3, target)).toEqual({ ok: true, value: undefined });
      expect(GameApi.assignMove(Player.SELF, 1, target)).toEqual({ ok: true, value: undefined });
      expect(GameApi.assignMove(Player.SELF, 2, target)).toEqual({ ok: true, value: undefined });
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
      expect(result).toEqual({ ok: true, value: undefined });
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
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test("when target equals piece's initialPosition (stay in place), assignment succeeds if capacity allows", () => {
      GameApi.initializeGame({ layer: 4 });
      setupSelfPieceAt(0, 0);
      const stayTarget = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });

      const result = GameApi.assignMove(Player.SELF, 1, stayTarget);
      expect(result).toEqual({ ok: true, value: undefined });

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
      expect(result).toEqual({ ok: true, value: undefined });

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
          pieceType: PieceType.KNIGHT,
        }),
      );
      PiecesRepository.add(
        new Piece({
          id: 11,
          panelPosition: origin,
          initialPosition: origin,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
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
      expect(result).toEqual({ ok: true, value: undefined });

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
      expect(result).toEqual({ ok: true, value: undefined });

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
      expect(result).toEqual({ ok: true, value: undefined });
      expect(TurnRepository.get().generationMode[String(Player.SELF)]).toBe("front");
    });

    test("when SELF sets mode to 'rear', TurnRepository generationMode for SELF stays 'rear'", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.setGenerationMode(Player.SELF, "rear");
      expect(result).toEqual({ ok: true, value: undefined });
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

    test("when wall is destroyed, overflow wall damage is converted into piece damage and attackers stay if defenders remain", () => {
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
      expect(piece.panelPosition.equals(origin)).toBe(true);
      expect(piece.targetPosition).toBeUndefined();
    });

    test("when overflow damage defeats the last defender, the attacker enters the panel", () => {
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
      expect(attacker.panelPosition.equals(target)).toBe(true);
      expect(attacker.targetPosition).toBeUndefined();

      const panel = PanelRepository.find(target)!;
      expect(panel.castle).toBe(0);
      expect(panel.player).toBe(Player.SELF);
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

    test("when front-line defender is killed and no wall remains, surviving attackers enter the panel", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      // Defender with low HP
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

      // KNIGHT AP=5 kills BISHOP with 1 HP. BISHOP AP=0 deals no damage.
      const defender = PiecesRepository.getAll().find((p) => p.id === 50);
      expect(defender).toBeUndefined();

      const attacker = PiecesRepository.getAll().find((p) => p.id === 1)!;
      expect(attacker.panelPosition.equals(target)).toBe(true);
    });

    test("when front-line attacker is killed, attacker is removed and remaining attackers stay at origin", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      // Strong defender: ROOK with full HP
      PiecesRepository.add(
        new Piece({
          id: 50,
          panelPosition: target,
          initialPosition: target,
          player: Player.OPPONENT,
          pieceType: PieceType.ROOK,
        }),
      );

      const origin = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      // Attacker with very low HP — will die from defender's counter
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
          hp: 1,
        }),
      );
      // Second attacker
      PiecesRepository.add(
        new Piece({
          id: 2,
          panelPosition: origin,
          initialPosition: origin,
          targetPosition: target,
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );

      GameApi.endTurn(Player.SELF);

      // Front-line attacker selection: both KNIGHT, id=1 selected (lowest ID)
      // Defender (ROOK) AP=2, attacker HP=1 → dead
      // Attacker group total AP=5+5=10, defender ROOK HP=10-10=0 → dead
      // Both front-liners die. Target is now clear. Remaining attacker(id=2) enters.
      const piece1 = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(piece1).toBeUndefined();
      const piece2 = PiecesRepository.getAll().find((p) => p.id === 2);
      expect(piece2).toBeDefined();
      // Defender also killed, so piece2 should enter
      expect(piece2!.panelPosition.equals(target)).toBe(true);
    });

    test("front-line selection prioritizes Rook > Knight > Bishop, with lowest ID as tiebreaker", () => {
      GameApi.initializeGame({ layer: 4 });
      const target = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
      const targetPanel = PanelRepository.find(target)!;
      PanelRepository.update(new Panel({ ...targetPanel, player: Player.OPPONENT, castle: 0 }));
      // Defender: a KNIGHT
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
      // Attackers: BISHOP(id=1) and ROOK(id=2) — ROOK should be front-line (even with higher ID)
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

      // ROOK (id=2) is front-line attacker, takes defender counter-attack AP=5
      // Attacker BISHOP AP=0 + ROOK AP=2 = 2 total → defender HP 10-2=8
      // Defender AP=5 → ROOK HP 10-5=5
      const rook = PiecesRepository.getAll().find((p) => p.id === 2);
      expect(rook).toBeDefined();
      expect(rook!.hp).toBe(
        PieceType.ROOK.config.maxHp - PieceType.KNIGHT.config.attackPowerAgainstPiece,
      );

      // BISHOP should be undamaged
      const bishop = PiecesRepository.getAll().find((p) => p.id === 1);
      expect(bishop).toBeDefined();
      expect(bishop!.hp).toBe(PieceType.BISHOP.config.maxHp);
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
    test("endTurn returns TurnEndResult with combatOutcomes array, winner, and nextPlayer", () => {
      GameApi.initializeGame({ layer: 4 });

      const result = GameApi.endTurn(Player.SELF);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveProperty("combatOutcomes");
        expect(Array.isArray(result.value.combatOutcomes)).toBe(true);
        expect(result.value).toHaveProperty("winner");
        expect(result.value).toHaveProperty("nextPlayer");
        expect(result.value.winner).toBeNull();
        expect(result.value.nextPlayer).toBe(Player.OPPONENT);
      }
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

  test("when piece's own position (stay) would exceed capacity, it is excluded from results", () => {
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
    // Piece 3 also at same position — capacity is 2, so 3 pieces exceed capacity for "stay"
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
    // Own position should be excluded because projectedCount(2 others) + 1 = 3 > maxPiecesPerPanel(2)
    expect(targets.some((t) => t.equals(pos))).toBe(false);
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
