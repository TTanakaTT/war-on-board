import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { GenerationService } from "$lib/services/GenerationService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import { ActionError } from "$lib/domain/enums/ActionError";
import { InvariantService } from "$lib/services/InvariantService";
import type {
  ControllablePlayerSnapshot,
  GameStateSnapshot,
  PanelPositionSnapshot,
  PanelStateSnapshot,
  PieceTypeSnapshot,
  PlayerSnapshot,
} from "$lib/domain/types/api";
import {
  RESOURCE_THRESHOLD_FOR_GENERATION,
  DEFAULT_MAX_PIECES_PER_PANEL,
} from "$lib/domain/constants/GameConstants";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

describe("GenerationService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("findGenerationPanel", () => {
    test("returns home base position when it meets all conditions in rear mode", () => {
      // Home base at (-3, 0) has resource=HOME_BASE_INIT_RESOURCE (5) >= threshold (5)
      const result = GenerationService.findGenerationPanel(Player.SELF);
      expect(result).not.toBeNull();
      expect(result!.horizontalLayer).toBe(-3);
      expect(result!.verticalLayer).toBe(0);
    });

    test("returns null when no panels are owned by the player", () => {
      // Change all SELF-owned panels to UNKNOWN
      const panels = PanelRepository.getAll();
      for (const p of panels) {
        if (p.player === Player.SELF) {
          PanelRepository.update(new Panel({ ...p, player: Player.UNKNOWN }));
        }
      }
      expect(GenerationService.findGenerationPanel(Player.SELF)).toBeNull();
    });

    test("returns null when all owned panels have resource below threshold", () => {
      // Set home base resource to 0
      const homePanel = PanelRepository.find(pos(-3, 0))!;
      PanelRepository.update(new Panel({ ...homePanel, resource: 0 }));
      expect(GenerationService.findGenerationPanel(Player.SELF)).toBeNull();
    });

    test("returns null when all owned panels are at max capacity", () => {
      // Fill home base with max pieces
      for (let i = 0; i < DEFAULT_MAX_PIECES_PER_PANEL; i++) {
        PiecesRepository.add(
          new Piece({
            id: i + 1,
            panelPosition: pos(-3, 0),
            player: Player.SELF,
            pieceType: PieceType.INFANTRY,
          }),
        );
      }
      expect(GenerationService.findGenerationPanel(Player.SELF)).toBeNull();
    });

    test("allows full panel when pieceType is mergeable and same-type piece exists there", () => {
      // Fill home base to max with Infantry
      for (let i = 0; i < DEFAULT_MAX_PIECES_PER_PANEL; i++) {
        PiecesRepository.add(
          new Piece({
            id: i + 1,
            panelPosition: pos(-3, 0),
            player: Player.SELF,
            pieceType: PieceType.INFANTRY,
          }),
        );
      }
      // With pieceType=INFANTRY (mergeable), panel should be accepted
      const result = GenerationService.findGenerationPanel(Player.SELF, PieceType.INFANTRY);
      expect(result).not.toBeNull();
      expect(result!.horizontalLayer).toBe(-3);
    });

    test("returns null for full panel when pieceType is non-mergeable even if same-type exists", () => {
      for (let i = 0; i < DEFAULT_MAX_PIECES_PER_PANEL; i++) {
        PiecesRepository.add(
          new Piece({
            id: i + 1,
            panelPosition: pos(-3, 0),
            player: Player.SELF,
            pieceType: PieceType.NOBLE,
          }),
        );
      }
      // Noble is non-mergeable — panel should be rejected
      expect(GenerationService.findGenerationPanel(Player.SELF, PieceType.NOBLE)).toBeNull();
    });

    test("returns null for full panel when mergeable pieceType differs from existing pieces", () => {
      // Fill with Rooks (non-mergeable), try to generate Infantry (mergeable but no match)
      for (let i = 0; i < DEFAULT_MAX_PIECES_PER_PANEL; i++) {
        PiecesRepository.add(
          new Piece({
            id: i + 1,
            panelPosition: pos(-3, 0),
            player: Player.SELF,
            pieceType: PieceType.ROOK,
          }),
        );
      }
      expect(GenerationService.findGenerationPanel(Player.SELF, PieceType.INFANTRY)).toBeNull();
    });

    describe.each([Player.SELF, Player.OPPONENT])(
      "same-type piece in transit on a full panel (%s)",
      (player) => {
        const side = player === Player.SELF ? -1 : 1;
        const homeBase = pos(3 * side, 0);
        const nextToHomeBase = pos(2 * side, 0);

        function addHeavyAndRookAtHomeBase(heavyInTransit: boolean): void {
          PiecesRepository.add(
            new Piece({
              id: 1,
              panelPosition: homeBase,
              player,
              pieceType: PieceType.HEAVY,
              targetPosition: heavyInTransit ? nextToHomeBase : undefined,
              transitPosition: heavyInTransit ? nextToHomeBase : undefined,
              movementPoints: heavyInTransit ? 0.25 : 0,
            }),
          );
          PiecesRepository.add(
            new Piece({ id: 2, panelPosition: homeBase, player, pieceType: PieceType.ROOK }),
          );
        }

        test("does not let a new piece merge into a same-type piece that is in transit", () => {
          addHeavyAndRookAtHomeBase(true);
          expect(GenerationService.findGenerationPanel(player, PieceType.HEAVY)).toBeNull();
        });

        test("lets a new piece merge into a same-type piece that is not in transit", () => {
          addHeavyAndRookAtHomeBase(false);
          expect(GenerationService.findGenerationPanel(player, PieceType.HEAVY)).toEqual(homeBase);
        });
      },
    );

    test("prefers higher |horizontalLayer| in rear mode (closer to home)", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({
        ...turn,
        generationMode: { ...turn.generationMode, [String(Player.SELF)]: "rear" },
      });

      // Give panel at (-2, 0) enough resource and SELF ownership
      const panel2 = PanelRepository.find(pos(-2, 0))!;
      PanelRepository.update(
        new Panel({ ...panel2, player: Player.SELF, resource: RESOURCE_THRESHOLD_FOR_GENERATION }),
      );
      // Home base at (-3, 0) also qualifies
      const result = GenerationService.findGenerationPanel(Player.SELF);
      // In rear mode, home base has priority, then highest |hl|
      expect(result!.horizontalLayer).toBe(-3);
    });

    test("prefers lower |horizontalLayer| in front mode (closer to enemy)", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({
        ...turn,
        generationMode: { ...turn.generationMode, [String(Player.SELF)]: "front" },
      });
      // Give panel at (-2, 0) enough resource and SELF ownership
      const panel2 = PanelRepository.find(pos(-2, 0))!;
      PanelRepository.update(
        new Panel({ ...panel2, player: Player.SELF, resource: RESOURCE_THRESHOLD_FOR_GENERATION }),
      );
      const result = GenerationService.findGenerationPanel(Player.SELF);
      // In front mode, lower |hl| first → (-2, 0) before (-3, 0)
      expect(result!.horizontalLayer).toBe(-2);
    });

    test("does not prioritize home base in front mode", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({
        ...turn,
        generationMode: { ...turn.generationMode, [String(Player.SELF)]: "front" },
      });
      // Only home base qualifies initially, but add a front panel too
      const panel1 = PanelRepository.find(pos(-1, 0))!;
      PanelRepository.update(
        new Panel({ ...panel1, player: Player.SELF, resource: RESOURCE_THRESHOLD_FOR_GENERATION }),
      );
      const result = GenerationService.findGenerationPanel(Player.SELF);
      // Front mode: |-1| < |-3|, so (-1, 0) preferred
      expect(result!.horizontalLayer).toBe(-1);
    });

    test("in front mode, prefers an enemy-side panel when it is closer to the opponent home base", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({
        ...turn,
        generationMode: { ...turn.generationMode, [String(Player.SELF)]: "front" },
      });

      const homeSidePanel = PanelRepository.find(pos(-1, 0))!;
      PanelRepository.update(
        new Panel({
          ...homeSidePanel,
          player: Player.SELF,
          resource: RESOURCE_THRESHOLD_FOR_GENERATION,
        }),
      );

      const enemySidePanel = PanelRepository.find(pos(2, 0))!;
      PanelRepository.update(
        new Panel({
          ...enemySidePanel,
          player: Player.SELF,
          resource: RESOURCE_THRESHOLD_FOR_GENERATION + 1,
        }),
      );

      const result = GenerationService.findGenerationPanel(Player.SELF);

      expect(result!.horizontalLayer).toBe(2);
      expect(result!.verticalLayer).toBe(0);
    });

    test("breaks ties by ascending verticalLayer", () => {
      // Give two panels at same |hl| enough resources
      const panel20 = PanelRepository.find(pos(-2, 0))!;
      const panel21 = PanelRepository.find(pos(-2, 1))!;
      PanelRepository.update(
        new Panel({ ...panel20, player: Player.SELF, resource: RESOURCE_THRESHOLD_FOR_GENERATION }),
      );
      PanelRepository.update(
        new Panel({ ...panel21, player: Player.SELF, resource: RESOURCE_THRESHOLD_FOR_GENERATION }),
      );
      // Fill home base so it's not a candidate
      for (let i = 0; i < DEFAULT_MAX_PIECES_PER_PANEL; i++) {
        PiecesRepository.add(
          new Piece({
            id: i + 10,
            panelPosition: pos(-3, 0),
            player: Player.SELF,
            pieceType: PieceType.INFANTRY,
          }),
        );
      }
      const result = GenerationService.findGenerationPanel(Player.SELF);
      expect(result!.horizontalLayer).toBe(-2);
      expect(result!.verticalLayer).toBe(0);
    });
  });

  describe("generate", () => {
    test("creates an INFANTRY by default when no pieceType specified", () => {
      // Ensure enough resources
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 20 } });
      GenerationService.generate();
      const pieces = PiecesRepository.getAll();
      expect(pieces.length).toBe(1);
      expect(pieces[0].pieceType).toBe(PieceType.INFANTRY);
    });

    test("deducts cost from player resources", () => {
      const turn = TurnRepository.get();
      const initialResources = 20;
      TurnRepository.set({
        ...turn,
        resources: { ...turn.resources, [String(Player.SELF)]: initialResources },
      });
      GenerationService.generate(PieceType.INFANTRY);
      const newResources = TurnRepository.get().resources[String(Player.SELF)];
      expect(newResources).toBe(initialResources - PieceType.INFANTRY.config.cost);
    });

    test("places piece on the generation panel", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 20 } });
      GenerationService.generate(PieceType.INFANTRY);
      const piece = PiecesRepository.getAll()[0];
      // Should be placed on home base (best generation panel in rear mode)
      expect(piece.panelPosition.horizontalLayer).toBe(-3);
      expect(piece.panelPosition.verticalLayer).toBe(0);
    });

    test("uses the provided generation position and returns the actual spawn location", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({
        ...turn,
        resources: { ...turn.resources, [String(Player.SELF)]: 20 },
        generationMode: { ...turn.generationMode, [String(Player.SELF)]: "front" },
      });

      const frontPanel = PanelRepository.find(pos(-2, 0))!;
      PanelRepository.update(
        new Panel({
          ...frontPanel,
          player: Player.SELF,
          resource: RESOURCE_THRESHOLD_FOR_GENERATION,
        }),
      );

      const forcedPosition = pos(-3, 0);
      const generatedPosition = GenerationService.generate(PieceType.INFANTRY, forcedPosition);

      expect(generatedPosition?.equals(forcedPosition)).toBe(true);

      const pieces = PiecesRepository.getAll();
      expect(pieces).toHaveLength(1);
      expect(pieces[0].panelPosition.equals(forcedPosition)).toBe(true);
    });

    test("does nothing when resources are insufficient", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 0 } });
      GenerationService.generate(PieceType.INFANTRY);
      expect(PiecesRepository.getAll()).toHaveLength(0);
    });

    test("does nothing when no generation panel is available", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 20 } });
      // Fill home base (only qualified panel) with non-mergeable Rooks
      for (let i = 0; i < DEFAULT_MAX_PIECES_PER_PANEL; i++) {
        PiecesRepository.add(
          new Piece({
            id: i + 1,
            panelPosition: pos(-3, 0),
            player: Player.SELF,
            pieceType: PieceType.ROOK,
          }),
        );
      }
      const pieceCountBefore = PiecesRepository.getAll().length;
      GenerationService.generate(PieceType.ROOK);
      expect(PiecesRepository.getAll().length).toBe(pieceCountBefore);
    });

    test("preserves existing panel resource and castle values", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 20 } });
      const homePanel = PanelRepository.find(pos(-3, 0))!;
      const originalResource = homePanel.resource;
      const originalCastle = homePanel.castle;
      GenerationService.generate(PieceType.INFANTRY);
      const updatedPanel = PanelRepository.find(pos(-3, 0))!;
      // Resource is preserved (not consumed from panel, only from turn resources)
      expect(updatedPanel.resource).toBe(originalResource);
      expect(updatedPanel.castle).toBe(originalCastle);
    });
  });
});

describe.each([Player.SELF, Player.OPPONENT])(
  "GenerationService capacity with reserved moves (%s)",
  (player) => {
    // Mirror horizontal positions so both players run through the same scenarios.
    const side = player === Player.SELF ? -1 : 1;
    const at = (h: number, v: number) => pos(side * h, v);
    const home = at(3, 0);
    const nextCandidate = at(2, 0);
    const neighbor = at(2, 1);

    const setTurn = () => {
      const turn = TurnRepository.get();
      TurnRepository.set({
        ...turn,
        player,
        resources: { ...turn.resources, [String(player)]: 100 },
        generationMode: { ...turn.generationMode, [String(player)]: "rear" },
      });
    };

    const ownPanel = (position: PanelPosition, resource: number) => {
      const panel = PanelRepository.find(position)!;
      PanelRepository.update(new Panel({ ...panel, player, resource }));
    };

    const addPiece = (
      id: number,
      panelPosition: PanelPosition,
      pieceType: PieceType,
      targetPosition?: PanelPosition,
    ) => {
      PiecesRepository.add(new Piece({ id, panelPosition, player, pieceType, targetPosition }));
    };

    beforeEach(() => {
      GameApi.initializeGame({ layer: 4 });
      setTurn();
      ownPanel(neighbor, 0);
    });

    test("skips a panel whose projected count is full by inflows and uses the next candidate", () => {
      ownPanel(nextCandidate, RESOURCE_THRESHOLD_FOR_GENERATION);
      addPiece(1, neighbor, PieceType.ROOK, home);
      addPiece(2, neighbor, PieceType.NOBLE, home);

      const result = GenerationService.findGenerationPanel(player, PieceType.ROOK);
      expect(result?.equals(nextCandidate)).toBe(true);

      expect(GameApi.generatePiece(player, PieceType.ROOK).ok).toBe(true);
      const spawned = PiecesRepository.getAll().find((piece) => piece.id === 3);
      expect(spawned?.panelPosition.equals(nextCandidate)).toBe(true);
    });

    test("returns no panel when every candidate is full by projected or current count", () => {
      ownPanel(nextCandidate, RESOURCE_THRESHOLD_FOR_GENERATION);
      addPiece(1, neighbor, PieceType.ROOK, home);
      addPiece(2, neighbor, PieceType.NOBLE, home);
      addPiece(3, nextCandidate, PieceType.ROOK);
      addPiece(4, nextCandidate, PieceType.NOBLE);

      expect(GenerationService.findGenerationPanel(player, PieceType.ROOK)).toBeNull();
      expect(GameApi.canGenerate(player, PieceType.ROOK)).toBe(false);
      const generated = GameApi.generatePiece(player, PieceType.ROOK);
      expect(generated.ok).toBe(false);
      if (!generated.ok) expect(generated.error).toBe(ActionError.NO_GENERATION_PANEL);
      expect(PiecesRepository.getAll()).toHaveLength(4);
    });

    test("does not generate on a panel that is currently full even if its pieces will leave", () => {
      addPiece(1, home, PieceType.ROOK, neighbor);
      addPiece(2, home, PieceType.NOBLE, neighbor);

      expect(GenerationService.findGenerationPanel(player, PieceType.ROOK)).toBeNull();
      expect(GenerationService.findGenerationPanel(player, PieceType.INFANTRY)).toBeNull();
      expect(GenerationService.findGenerationPanel(player)).toBeNull();
    });

    test("generates on a full panel holding the same type and merges into it, keeping its move", () => {
      addPiece(1, home, PieceType.INFANTRY, neighbor);
      addPiece(2, home, PieceType.ROOK);

      expect(GameApi.generatePiece(player, PieceType.INFANTRY).ok).toBe(true);

      const piecesAtHome = PiecesRepository.getPiecesByPosition(home);
      expect(piecesAtHome).toHaveLength(2);
      const infantry = piecesAtHome.find((piece) => piece.pieceType === PieceType.INFANTRY)!;
      expect(infantry.id).toBe(1);
      expect(infantry.stackCount).toBe(2);
      expect(infantry.targetPosition?.equals(neighbor)).toBe(true);
    });

    test("generates on a projected-full panel when the same type flows in, and stays within capacity after endTurn", () => {
      addPiece(1, home, PieceType.ROOK);
      addPiece(2, neighbor, PieceType.INFANTRY);
      expect(GameApi.assignMove(player, 2, home).ok).toBe(true);

      expect(GenerationService.findGenerationPanel(player, PieceType.ROOK)).toBeNull();
      expect(GenerationService.findGenerationPanel(player, PieceType.INFANTRY)?.equals(home)).toBe(
        true,
      );

      expect(GameApi.generatePiece(player, PieceType.INFANTRY).ok).toBe(true);
      expect(GameApi.endTurn(player).ok).toBe(true);

      const violations = InvariantService.check(GameApi.getGameState());
      expect(violations.filter((v) => v.type === "piece-capacity-exceeded")).toEqual([]);
      const ownAtHome = PiecesRepository.getPiecesByPosition(home).filter(
        (piece) => piece.player === player,
      );
      expect(ownAtHome).toHaveLength(2);
    });

    test("chooses different panels or availability depending on the piece type", () => {
      addPiece(1, neighbor, PieceType.ARCHER, home);
      addPiece(2, neighbor, PieceType.NOBLE, home);

      // Only the home base qualifies: archer merges with the inflowing archer, cavalry does not.
      expect(GenerationService.findGenerationPanel(player, PieceType.ARCHER)?.equals(home)).toBe(
        true,
      );
      expect(GenerationService.findGenerationPanel(player, PieceType.CAVALRY)).toBeNull();
      expect(GameApi.canGenerate(player, PieceType.ARCHER)).toBe(true);
      expect(GameApi.canGenerate(player, PieceType.CAVALRY)).toBe(false);

      // With a second candidate, cavalry falls through to it while archer stays on home.
      ownPanel(nextCandidate, RESOURCE_THRESHOLD_FOR_GENERATION);
      expect(GenerationService.findGenerationPanel(player, PieceType.ARCHER)?.equals(home)).toBe(
        true,
      );
      expect(
        GenerationService.findGenerationPanel(player, PieceType.CAVALRY)?.equals(nextCandidate),
      ).toBe(true);
    });
  },
);

type PositionTuple = [number, number];
type PanelRow = [number, number, PanelStateSnapshot, PlayerSnapshot, number, number];
// id, position, target, player, type, hp, stackCount, maxHp, movementPoints
type PieceRow = [
  number,
  PositionTuple,
  PositionTuple | null,
  ControllablePlayerSnapshot,
  PieceTypeSnapshot,
  number,
  number,
  number,
  number,
];

/**
 * Board from issue #85 after steps 1-7 (before generating the cavalry), with SELF to move:
 * the recorded "before" board without cavalry#15 and with its cost refunded.
 */
const issue85Snapshot = (): GameStateSnapshot => {
  const panelRows: PanelRow[] = [
    [-4, 0, "occupied", "self", 5, 10],
    [-3, 0, "occupied", "self", 2, 1],
    [-3, 1, "unoccupied", "self", 0, 1],
    [-2, 0, "unoccupied", "self", 1, 0],
    [-2, 1, "unoccupied", "self", 0, 0],
    [-2, 2, "unoccupied", "self", 0, 1],
    [-1, 0, "unoccupied", "unknown", 0, 0],
    [-1, 1, "unoccupied", "self", 1, 0],
    [-1, 2, "unoccupied", "self", 0, 0],
    [-1, 3, "unoccupied", "self", 0, 1],
    [0, 0, "unoccupied", "unknown", 0, 0],
    [0, 1, "unoccupied", "self", 1, 0],
    [0, 2, "unoccupied", "self", 1, 0],
    [0, 3, "unoccupied", "self", 0, 1],
    [0, 4, "unoccupied", "self", 0, 0],
    [1, 0, "occupied", "opponent", 0, 0],
    [1, 1, "occupied", "self", 2, 0],
    [1, 2, "occupied", "self", 0, 2],
    [1, 3, "occupied", "self", 0, 0],
    [2, 0, "occupied", "opponent", 2, 1],
    [2, 1, "occupied", "opponent", 0, 0],
    [2, 2, "unoccupied", "opponent", 0, 0],
    [3, 0, "occupied", "opponent", 2, 1],
    [3, 1, "unoccupied", "opponent", 0, 1],
    [4, 0, "occupied", "opponent", 5, 10],
  ];
  const pieceRows: PieceRow[] = [
    [3, [1, 1], [2, 0], "self", "infantry", 1, 1, 10, 1],
    [4, [2, 1], null, "opponent", "infantry", 26, 3, 30, 0],
    [5, [1, 2], [2, 2], "self", "rook", 10, 1, 10, 1],
    [6, [1, 0], null, "opponent", "rook", 6, 1, 10, 0],
    [7, [1, 3], [2, 2], "self", "infantry", 20, 2, 20, 1],
    [9, [-3, 0], [-4, 0], "self", "archer", 16, 2, 16, 1],
    [10, [-4, 0], [-3, 0], "self", "rook", 10, 1, 10, 1],
    [11, [2, 0], null, "opponent", "noble", 5, 1, 5, 0],
    [12, [-3, 0], [-4, 0], "self", "noble", 5, 1, 5, 1],
    [13, [3, 0], null, "opponent", "archer", 8, 1, 8, 0],
    [14, [4, 0], null, "opponent", "infantry", 10, 1, 10, 1],
  ];
  const toPosition = ([h, v]: PositionTuple): PanelPositionSnapshot => ({
    horizontalLayer: h,
    verticalLayer: v,
  });

  return {
    panels: panelRows.map(([h, v, panelState, owner, resource, castle]) => ({
      panelPosition: toPosition([h, v]),
      panelState,
      player: owner,
      resource,
      castle,
    })),
    pieces: pieceRows.map(
      ([id, position, target, owner, pieceType, hp, stackCount, maxHp, movementPoints]) => ({
        id,
        panelPosition: toPosition(position),
        initialPosition: toPosition(position),
        ...(target ? { targetPosition: toPosition(target) } : {}),
        player: owner,
        pieceType,
        hp,
        stackCount,
        maxHp,
        movementPoints,
      }),
    ),
    turn: {
      num: 11,
      player: "self",
      resources: { self: 3 + PieceType.CAVALRY.config.cost, opponent: 1 },
      maxPiecesPerPanel: { self: 2, opponent: 2 },
      generationMode: { self: "front", opponent: "front" },
      winner: null,
    },
    homeBases: [
      { player: "self", panelPosition: toPosition([-4, 0]) },
      { player: "opponent", panelPosition: toPosition([4, 0]) },
    ],
    layer: 5,
  };
};

/** Swaps the two sides of a snapshot (players and horizontal positions). */
const mirrorSnapshot = (snapshot: GameStateSnapshot): GameStateSnapshot => {
  const swap = <T extends PlayerSnapshot>(owner: T): T =>
    (owner === "self" ? "opponent" : owner === "opponent" ? "self" : owner) as T;
  const flip = (position: PanelPositionSnapshot): PanelPositionSnapshot => ({
    horizontalLayer: -position.horizontalLayer,
    verticalLayer: position.verticalLayer,
  });
  const swapRecord = <T>(record: Record<string, T>): Record<string, T> => ({
    self: record.opponent,
    opponent: record.self,
  });

  return {
    panels: snapshot.panels.map((panel) => ({
      ...panel,
      panelPosition: flip(panel.panelPosition),
      player: swap(panel.player),
    })),
    pieces: snapshot.pieces.map((piece) => ({
      ...piece,
      panelPosition: flip(piece.panelPosition),
      initialPosition: flip(piece.initialPosition),
      ...(piece.targetPosition ? { targetPosition: flip(piece.targetPosition) } : {}),
      player: swap(piece.player),
    })),
    turn: {
      ...snapshot.turn,
      player: swap(snapshot.turn.player),
      resources: swapRecord(snapshot.turn.resources),
      maxPiecesPerPanel: swapRecord(snapshot.turn.maxPiecesPerPanel),
      generationMode: swapRecord(snapshot.turn.generationMode),
    },
    homeBases: snapshot.homeBases.map((homeBase) => ({
      player: swap(homeBase.player),
      panelPosition: flip(homeBase.panelPosition),
    })),
    layer: snapshot.layer,
  };
};

describe.each([Player.SELF, Player.OPPONENT])("regression: issue #85 board (%s)", (player) => {
  const side = player === Player.SELF ? -1 : 1;
  const home = pos(side * 4, 0);

  beforeEach(() => {
    const snapshot = issue85Snapshot();
    const loaded = GameApi.loadGameState(
      player === Player.SELF ? snapshot : mirrorSnapshot(snapshot),
    );
    expect(loaded.ok).toBe(true);
  });

  test("cavalry cannot be generated", () => {
    expect(GameApi.canGenerate(player, PieceType.CAVALRY)).toBe(false);
    const generated = GameApi.generatePiece(player, PieceType.CAVALRY);
    expect(generated.ok).toBe(false);
    if (!generated.ok) expect(generated.error).toBe(ActionError.NO_GENERATION_PANEL);
  });

  test("archer is generated on the home base and endTurn stays within capacity", () => {
    expect(GameApi.generatePiece(player, PieceType.ARCHER).ok).toBe(true);
    const spawned = PiecesRepository.getAll().find((piece) => piece.id === 15);
    expect(spawned?.pieceType).toBe(PieceType.ARCHER);
    expect(spawned?.panelPosition.equals(home)).toBe(true);

    expect(GameApi.endTurn(player).ok).toBe(true);
    const violations = InvariantService.check(GameApi.getGameState());
    expect(violations.filter((violation) => violation.type === "piece-capacity-exceeded")).toEqual(
      [],
    );
  });
});
