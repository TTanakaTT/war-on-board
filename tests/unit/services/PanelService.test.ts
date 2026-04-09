import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { PanelsService } from "$lib/services/PanelService";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import {
  HOME_BASE_INIT_RESOURCE,
  HOME_BASE_INIT_CASTLE,
} from "$lib/domain/constants/GameConstants";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

describe("PanelsService", () => {
  describe("initialize", () => {
    test("creates correct number of panels for given layer", () => {
      // layer^2 panels: layer=4 → 16
      const panels = PanelsService.initialize(4);
      expect(panels).toHaveLength(16);
    });

    test("assigns Player.SELF to leftmost home base panel", () => {
      const panels = PanelsService.initialize(4);
      const selfHome = panels.find(
        (p) => p.panelPosition.horizontalLayer === -3 && p.panelPosition.verticalLayer === 0,
      );
      expect(selfHome).toBeDefined();
      expect(selfHome!.player).toBe(Player.SELF);
    });

    test("assigns Player.OPPONENT to rightmost home base panel", () => {
      const panels = PanelsService.initialize(4);
      const oppHome = panels.find(
        (p) => p.panelPosition.horizontalLayer === 3 && p.panelPosition.verticalLayer === 0,
      );
      expect(oppHome).toBeDefined();
      expect(oppHome!.player).toBe(Player.OPPONENT);
    });

    test("assigns Player.UNKNOWN to all non-home-base panels", () => {
      const panels = PanelsService.initialize(4);
      const nonHome = panels.filter(
        (p) =>
          !(Math.abs(p.panelPosition.horizontalLayer) === 3 && p.panelPosition.verticalLayer === 0),
      );
      expect(nonHome.length).toBeGreaterThan(0);
      for (const p of nonHome) {
        expect(p.player).toBe(Player.UNKNOWN);
      }
    });

    test("sets initial resource and castle on home base panels only", () => {
      const panels = PanelsService.initialize(4);
      for (const p of panels) {
        const isHome =
          Math.abs(p.panelPosition.horizontalLayer) === 3 && p.panelPosition.verticalLayer === 0;
        if (isHome) {
          expect(p.resource).toBe(HOME_BASE_INIT_RESOURCE);
          expect(p.castle).toBe(HOME_BASE_INIT_CASTLE);
        } else {
          expect(p.resource).toBe(0);
          expect(p.castle).toBe(0);
        }
      }
    });

    test("sets all panels to UNOCCUPIED state", () => {
      const panels = PanelsService.initialize(4);
      for (const p of panels) {
        expect(p.panelState).toBe(PanelState.UNOCCUPIED);
      }
    });
  });

  describe("find", () => {
    beforeEach(() => {
      GameApi.initializeGame({ layer: 4 });
    });

    test("returns panel matching the given position", () => {
      const panel = PanelsService.find(pos(0, 0));
      expect(panel).toBeDefined();
      expect(panel!.panelPosition.horizontalLayer).toBe(0);
      expect(panel!.panelPosition.verticalLayer).toBe(0);
    });

    test("returns undefined when position does not exist", () => {
      expect(PanelsService.find(pos(99, 99))).toBeUndefined();
    });
  });

  describe("findPanelState", () => {
    beforeEach(() => {
      GameApi.initializeGame({ layer: 4 });
    });

    test("returns panelState for existing position", () => {
      const state = PanelsService.findPanelState(pos(0, 0));
      expect(state).toBe(PanelState.UNOCCUPIED);
    });

    test("returns undefined for non-existing position", () => {
      expect(PanelsService.findPanelState(pos(99, 99))).toBeUndefined();
    });
  });

  describe("findAdjacentPanels", () => {
    beforeEach(() => {
      GameApi.initializeGame({ layer: 4 });
    });

    test("returns all adjacent panels for a center position", () => {
      // pos(0, 0) in layer=4 should have multiple neighbors
      const adjacent = PanelsService.findAdjacentPanels(pos(0, 0));
      expect(adjacent.length).toBeGreaterThan(0);
      for (const a of adjacent) {
        expect(a.panelPosition.isAdjacent(pos(0, 0))).toBe(true);
      }
    });

    test("returns fewer panels for edge positions", () => {
      // Home base at (-3, 0) is an edge position
      const edgeAdj = PanelsService.findAdjacentPanels(pos(-3, 0));
      const centerAdj = PanelsService.findAdjacentPanels(pos(0, 0));
      expect(edgeAdj.length).toBeLessThan(centerAdj.length);
    });

    test("returns empty array for position with no neighbors", () => {
      // Position far outside the board
      const adj = PanelsService.findAdjacentPanels(pos(99, 99));
      expect(adj).toHaveLength(0);
    });
  });

  describe("clearSelected", () => {
    beforeEach(() => {
      GameApi.initializeGame({ layer: 4 });
    });

    test("resets MOVABLE panels to OCCUPIED when pieces are present", () => {
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, panelState: PanelState.MOVABLE }));
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(0, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      const cleared = PanelsService.clearSelected();
      const p = cleared.find((x) => x.panelPosition.equals(pos(0, 0)))!;
      expect(p.panelState).toBe(PanelState.OCCUPIED);
    });

    test("resets MOVABLE panels to UNOCCUPIED when no pieces are present", () => {
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, panelState: PanelState.MOVABLE }));
      const cleared = PanelsService.clearSelected();
      const p = cleared.find((x) => x.panelPosition.equals(pos(0, 0)))!;
      expect(p.panelState).toBe(PanelState.UNOCCUPIED);
    });

    test("resets SELECTED panels similarly", () => {
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, panelState: PanelState.SELECTED }));
      const cleared = PanelsService.clearSelected();
      const p = cleared.find((x) => x.panelPosition.equals(pos(0, 0)))!;
      expect(p.panelState).toBe(PanelState.UNOCCUPIED);
    });

    test("resets IMMOVABLE panels similarly", () => {
      const panel = PanelRepository.find(pos(0, 0))!;
      PanelRepository.update(new Panel({ ...panel, panelState: PanelState.IMMOVABLE }));
      const cleared = PanelsService.clearSelected();
      const p = cleared.find((x) => x.panelPosition.equals(pos(0, 0)))!;
      expect(p.panelState).toBe(PanelState.UNOCCUPIED);
    });

    test("does not modify OCCUPIED or UNOCCUPIED panels", () => {
      const panel = PanelRepository.find(pos(0, 0))!;
      expect(panel.panelState).toBe(PanelState.UNOCCUPIED);
      const cleared = PanelsService.clearSelected();
      const p = cleared.find((x) => x.panelPosition.equals(pos(0, 0)))!;
      expect(p.panelState).toBe(PanelState.UNOCCUPIED);
    });
  });

  describe("refreshPanelStates", () => {
    beforeEach(() => {
      GameApi.initializeGame({ layer: 4 });
    });

    test("sets panel to OCCUPIED when pieces exist at position", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(0, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PanelsService.refreshPanelStates();
      const panel = PanelRepository.find(pos(0, 0))!;
      expect(panel.panelState).toBe(PanelState.OCCUPIED);
    });

    test("sets panel to UNOCCUPIED when no pieces exist at position", () => {
      PanelsService.refreshPanelStates();
      const panel = PanelRepository.find(pos(0, 0))!;
      expect(panel.panelState).toBe(PanelState.UNOCCUPIED);
    });

    test("updates panel player to match piece owner", () => {
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(0, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PanelsService.refreshPanelStates();
      const panel = PanelRepository.find(pos(0, 0))!;
      expect(panel.player).toBe(Player.SELF);
    });

    test("preserves panel resource and castle values", () => {
      const panel = PanelRepository.find(pos(-3, 0))!;
      const originalResource = panel.resource;
      const originalCastle = panel.castle;
      PiecesRepository.add(
        new Piece({
          id: 1,
          panelPosition: pos(-3, 0),
          player: Player.SELF,
          pieceType: PieceType.KNIGHT,
        }),
      );
      PanelsService.refreshPanelStates();
      const updated = PanelRepository.find(pos(-3, 0))!;
      expect(updated.resource).toBe(originalResource);
      expect(updated.castle).toBe(originalCastle);
    });
  });
});
