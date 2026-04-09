import { describe, test, expect } from "vitest";
import { HomeBase } from "$lib/domain/entities/HomeBase";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Player } from "$lib/domain/enums/Player";

describe("HomeBase", () => {
  describe("constructor", () => {
    test("creates home base with player and panelPosition", () => {
      const pos = new PanelPosition({ horizontalLayer: -3, verticalLayer: 0 });
      const hb = new HomeBase({ player: Player.SELF, panelPosition: pos });
      expect(hb.player).toBe(Player.SELF);
      expect(hb.panelPosition.horizontalLayer).toBe(-3);
      expect(hb.panelPosition.verticalLayer).toBe(0);
    });
  });
});
