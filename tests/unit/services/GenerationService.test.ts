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
            pieceType: PieceType.KNIGHT,
          }),
        );
      }
      expect(GenerationService.findGenerationPanel(Player.SELF)).toBeNull();
    });

    test("allows full panel when pieceType is mergeable and same-type piece exists there", () => {
      // Fill home base to max with Knights
      for (let i = 0; i < DEFAULT_MAX_PIECES_PER_PANEL; i++) {
        PiecesRepository.add(
          new Piece({
            id: i + 1,
            panelPosition: pos(-3, 0),
            player: Player.SELF,
            pieceType: PieceType.KNIGHT,
          }),
        );
      }
      // With pieceType=KNIGHT (mergeable), panel should be accepted
      const result = GenerationService.findGenerationPanel(Player.SELF, PieceType.KNIGHT);
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
            pieceType: PieceType.BISHOP,
          }),
        );
      }
      // Bishop is non-mergeable — panel should be rejected
      expect(GenerationService.findGenerationPanel(Player.SELF, PieceType.BISHOP)).toBeNull();
    });

    test("returns null for full panel when mergeable pieceType differs from existing pieces", () => {
      // Fill with Rooks (non-mergeable), try to generate Knight (mergeable but no match)
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
      expect(GenerationService.findGenerationPanel(Player.SELF, PieceType.KNIGHT)).toBeNull();
    });

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
            pieceType: PieceType.KNIGHT,
          }),
        );
      }
      const result = GenerationService.findGenerationPanel(Player.SELF);
      expect(result!.horizontalLayer).toBe(-2);
      expect(result!.verticalLayer).toBe(0);
    });
  });

  describe("generate", () => {
    test("creates a KNIGHT by default when no pieceType specified", () => {
      // Ensure enough resources
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 20 } });
      GenerationService.generate();
      const pieces = PiecesRepository.getAll();
      expect(pieces.length).toBe(1);
      expect(pieces[0].pieceType).toBe(PieceType.KNIGHT);
    });

    test("deducts cost from player resources", () => {
      const turn = TurnRepository.get();
      const initialResources = 20;
      TurnRepository.set({
        ...turn,
        resources: { ...turn.resources, [String(Player.SELF)]: initialResources },
      });
      GenerationService.generate(PieceType.KNIGHT);
      const newResources = TurnRepository.get().resources[String(Player.SELF)];
      expect(newResources).toBe(initialResources - PieceType.KNIGHT.config.cost);
    });

    test("places piece on the generation panel", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 20 } });
      GenerationService.generate(PieceType.KNIGHT);
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
      const generatedPosition = GenerationService.generate(PieceType.KNIGHT, forcedPosition);

      expect(generatedPosition?.equals(forcedPosition)).toBe(true);

      const pieces = PiecesRepository.getAll();
      expect(pieces).toHaveLength(1);
      expect(pieces[0].panelPosition.equals(forcedPosition)).toBe(true);
    });

    test("does nothing when resources are insufficient", () => {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, resources: { ...turn.resources, [String(Player.SELF)]: 0 } });
      GenerationService.generate(PieceType.KNIGHT);
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
      GenerationService.generate(PieceType.KNIGHT);
      const updatedPanel = PanelRepository.find(pos(-3, 0))!;
      // Resource is preserved (not consumed from panel, only from turn resources)
      expect(updatedPanel.resource).toBe(originalResource);
      expect(updatedPanel.castle).toBe(originalCastle);
    });
  });
});
