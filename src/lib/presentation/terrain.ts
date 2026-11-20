import type { Terrain } from "#lib/domain/model.ts";

// Literal class names so Tailwind can find them.
const ICON_TEXT_CLASSES: Record<Terrain, string> = {
  plain: "",
  hill: "text-terrain-hill dark:text-terrain-hill-dark",
  forest: "text-terrain-forest dark:text-terrain-forest-dark",
  mountain: "text-terrain-mountain dark:text-terrain-mountain-dark",
};

const ICON_FILL_CLASSES: Record<Terrain, string> = {
  plain: "",
  hill: "fill-terrain-hill dark:fill-terrain-hill-dark",
  forest: "fill-terrain-forest dark:fill-terrain-forest-dark",
  mountain: "fill-terrain-mountain dark:fill-terrain-mountain-dark",
};

/** Text color for a terrain icon drawn with <Icon>. */
export const terrainIconClass = (terrain: Terrain) => ICON_TEXT_CLASSES[terrain];

/** Fill color for a terrain icon drawn as a raw SVG path. */
export const terrainIconFillClass = (terrain: Terrain) => ICON_FILL_CLASSES[terrain];
