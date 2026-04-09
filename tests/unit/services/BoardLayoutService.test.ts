import { beforeEach, describe, test, expect } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import { BoardLayoutService } from "$lib/services/BoardLayoutService";
import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PANEL_HEIGHT, PANEL_MARGIN } from "$lib/presentation/constants/UiConstants";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

describe("BoardLayoutService", () => {
  beforeEach(() => {
    GameApi.initializeGame({ layer: 4 });
  });

  describe("geometry constants", () => {
    test("HEIGHT equals PANEL_HEIGHT from UiConstants", () => {
      expect(BoardLayoutService.HEIGHT).toBe(PANEL_HEIGHT);
    });

    test("PANEL_MARGIN equals PANEL_MARGIN from UiConstants", () => {
      expect(BoardLayoutService.PANEL_MARGIN).toBe(PANEL_MARGIN);
    });

    test("VERTICAL_SPACING equals HEIGHT + PANEL_MARGIN", () => {
      expect(BoardLayoutService.VERTICAL_SPACING).toBe(PANEL_HEIGHT + PANEL_MARGIN);
    });
  });

  describe("computed properties", () => {
    test("hypotenuseHorizontalLength is HEIGHT / 2 / sqrt(3)", () => {
      expect(BoardLayoutService.hypotenuseHorizontalLength).toBeCloseTo(
        PANEL_HEIGHT / 2 / Math.sqrt(3),
      );
    });

    test("horizontalSideLength is HEIGHT / sqrt(3)", () => {
      expect(BoardLayoutService.horizontalSideLength).toBeCloseTo(PANEL_HEIGHT / Math.sqrt(3));
    });

    test("horizontalLength is horizontalSideLength + hypotenuseHorizontalLength", () => {
      expect(BoardLayoutService.horizontalLength).toBeCloseTo(
        BoardLayoutService.horizontalSideLength + BoardLayoutService.hypotenuseHorizontalLength,
      );
    });
  });

  describe("boardWidth", () => {
    test("returns positive width for layer 4", () => {
      expect(BoardLayoutService.boardWidth).toBeGreaterThan(0);
    });

    test("increases as layer increases", () => {
      LayerRepository.set(4);
      const width4 = BoardLayoutService.boardWidth;
      LayerRepository.set(5);
      const width5 = BoardLayoutService.boardWidth;
      expect(width5).toBeGreaterThan(width4);
    });
  });

  describe("boardHeight", () => {
    test("returns positive height for layer 4", () => {
      expect(BoardLayoutService.boardHeight).toBeGreaterThan(0);
    });

    test("increases as layer increases", () => {
      LayerRepository.set(4);
      const height4 = BoardLayoutService.boardHeight;
      LayerRepository.set(5);
      const height5 = BoardLayoutService.boardHeight;
      expect(height5).toBeGreaterThan(height4);
    });
  });

  describe("getCoordinates", () => {
    test("returns center coordinates for position (0, 0)", () => {
      const coords = BoardLayoutService.getCoordinates(pos(0, 0));
      expect(coords.x).toBeGreaterThan(0);
      expect(coords.y).toBeGreaterThan(0);
    });

    test("x increases as horizontalLayer increases", () => {
      const c0 = BoardLayoutService.getCoordinates(pos(0, 0));
      const c1 = BoardLayoutService.getCoordinates(pos(1, 0));
      expect(c1.x).toBeGreaterThan(c0.x);
    });

    test("y increases as verticalLayer increases", () => {
      const c0 = BoardLayoutService.getCoordinates(pos(0, 0));
      const c1 = BoardLayoutService.getCoordinates(pos(0, 1));
      expect(c1.y).toBeGreaterThan(c0.y);
    });

    test("symmetric x for opposite horizontalLayers", () => {
      const cNeg = BoardLayoutService.getCoordinates(pos(-2, 0));
      const cPos = BoardLayoutService.getCoordinates(pos(2, 0));
      const center = BoardLayoutService.getCoordinates(pos(0, 0));
      // x offsets from center should be equal (symmetric)
      expect(Math.abs(cNeg.x - center.x)).toBeCloseTo(Math.abs(cPos.x - center.x));
    });
  });
});
