import { expect, test } from "vitest";
import { PIECE_TYPES, pieceConfig, TERRAINS, terrainConfig } from "#lib/domain/model.ts";
import { CUSTOM_PIECE_ICONS, MATERIAL_ICON_PATHS } from "#lib/presentation/icons.ts";

test("every piece type has an icon", () => {
  for (const type of PIECE_TYPES) {
    const { iconName } = pieceConfig(type);
    expect(MATERIAL_ICON_PATHS[iconName] ?? CUSTOM_PIECE_ICONS[iconName], iconName).toBeDefined();
  }
});

test("every terrain icon exists", () => {
  for (const terrain of TERRAINS) {
    const { iconName } = terrainConfig(terrain);
    if (iconName) expect(MATERIAL_ICON_PATHS[iconName], iconName).toBeDefined();
  }
});
