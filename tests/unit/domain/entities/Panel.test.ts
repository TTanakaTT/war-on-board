import { describe, test, expect } from "vitest";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PanelState } from "$lib/domain/enums/PanelState";
import { Player } from "$lib/domain/enums/Player";

const pos = (h: number, v: number) => new PanelPosition({ horizontalLayer: h, verticalLayer: v });

describe("Panel", () => {
  describe("constructor", () => {
    test("creates panel with all properties specified", () => {
      const panel = new Panel({
        panelPosition: pos(1, 2),
        panelState: PanelState.OCCUPIED,
        player: Player.SELF,
        resource: 3,
        castle: 5,
      });
      expect(panel.panelPosition.horizontalLayer).toBe(1);
      expect(panel.panelPosition.verticalLayer).toBe(2);
      expect(panel.panelState).toBe(PanelState.OCCUPIED);
      expect(panel.player).toBe(Player.SELF);
      expect(panel.resource).toBe(3);
      expect(panel.castle).toBe(5);
    });

    test("defaults player to Player.UNKNOWN when omitted", () => {
      const panel = new Panel({ panelPosition: pos(0, 0), panelState: PanelState.UNOCCUPIED });
      expect(panel.player).toBe(Player.UNKNOWN);
    });

    test("defaults resource to 0 when omitted", () => {
      const panel = new Panel({ panelPosition: pos(0, 0), panelState: PanelState.UNOCCUPIED });
      expect(panel.resource).toBe(0);
    });

    test("defaults castle to 0 when omitted", () => {
      const panel = new Panel({ panelPosition: pos(0, 0), panelState: PanelState.UNOCCUPIED });
      expect(panel.castle).toBe(0);
    });
  });

  describe("equals", () => {
    test("returns true when panelPosition and panelState match", () => {
      const a = new Panel({ panelPosition: pos(1, 2), panelState: PanelState.OCCUPIED });
      const b = new Panel({ panelPosition: pos(1, 2), panelState: PanelState.OCCUPIED });
      expect(a.equals(b)).toBe(true);
    });

    test("returns false when panelPosition differs", () => {
      const a = new Panel({ panelPosition: pos(1, 2), panelState: PanelState.OCCUPIED });
      const b = new Panel({ panelPosition: pos(2, 2), panelState: PanelState.OCCUPIED });
      expect(a.equals(b)).toBe(false);
    });

    test("returns false when panelState differs", () => {
      const a = new Panel({ panelPosition: pos(1, 2), panelState: PanelState.OCCUPIED });
      const b = new Panel({ panelPosition: pos(1, 2), panelState: PanelState.UNOCCUPIED });
      expect(a.equals(b)).toBe(false);
    });

    test("returns true even when player differs (not compared)", () => {
      const a = new Panel({
        panelPosition: pos(1, 2),
        panelState: PanelState.OCCUPIED,
        player: Player.SELF,
      });
      const b = new Panel({
        panelPosition: pos(1, 2),
        panelState: PanelState.OCCUPIED,
        player: Player.OPPONENT,
      });
      expect(a.equals(b)).toBe(true);
    });

    test("returns true even when resource differs (not compared)", () => {
      const a = new Panel({
        panelPosition: pos(1, 2),
        panelState: PanelState.OCCUPIED,
        resource: 3,
      });
      const b = new Panel({
        panelPosition: pos(1, 2),
        panelState: PanelState.OCCUPIED,
        resource: 10,
      });
      expect(a.equals(b)).toBe(true);
    });

    test("returns true even when castle differs (not compared)", () => {
      const a = new Panel({
        panelPosition: pos(1, 2),
        panelState: PanelState.OCCUPIED,
        castle: 2,
      });
      const b = new Panel({
        panelPosition: pos(1, 2),
        panelState: PanelState.OCCUPIED,
        castle: 8,
      });
      expect(a.equals(b)).toBe(true);
    });
  });
});
