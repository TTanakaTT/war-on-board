import { describe, expect, test } from "vitest";
import { PIECE_TYPES, pieceConfig } from "#lib/domain/model.ts";
import { CUSTOM_PIECE_ICONS, MATERIAL_ICON_PATHS } from "#lib/presentation/icons.ts";

describe("icons", () => {
  test("every piece type has an icon", () => {
    for (const pieceType of PIECE_TYPES) {
      const { iconName } = pieceConfig(pieceType);
      expect(MATERIAL_ICON_PATHS[iconName] ?? CUSTOM_PIECE_ICONS[iconName], iconName).toBeDefined();
    }
  });
});
