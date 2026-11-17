import { describe, expect, test } from "vitest";
import { CUSTOM_PIECE_ICONS } from "#lib/presentation/constants/CustomIcons.ts";
import { MATERIAL_ICON_PATHS } from "#lib/presentation/constants/MaterialIcons.ts";
import { PIECE_TYPE_DISPLAY_ORDER } from "#lib/presentation/piecePresentation.ts";

describe("MaterialIcons", () => {
  test("extracts a non-empty path for every icon", () => {
    for (const [name, path] of Object.entries(MATERIAL_ICON_PATHS)) {
      expect(path, name).toMatch(/^[Mm]/);
    }
  });

  test("has an icon for every piece type", () => {
    for (const pieceType of PIECE_TYPE_DISPLAY_ORDER) {
      const { iconName } = pieceType.config;
      expect(
        MATERIAL_ICON_PATHS[iconName] !== undefined || CUSTOM_PIECE_ICONS[iconName] !== undefined,
        iconName,
      ).toBe(true);
    }
  });
});
