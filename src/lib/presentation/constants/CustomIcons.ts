/**
 * Shape descriptors for piece icons with no material-symbols equivalent
 * (see docs/adr/0001-piece-token-custom-svg-icons.md). Rendered by
 * `Icon.svelte` inside a 24x24 viewBox `<svg>`, styled to match
 * material-symbols outlined: `currentColor` stroke, no fill except small
 * solid accents. Structured (rather than raw markup) so no `{@html}` is
 * needed to render them.
 *
 * Keyed by `PieceType.config.iconName`.
 */
export type IconShape =
  | { type: "path"; d: string; strokeWidth: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; strokeWidth: number }
  | { type: "polygon"; points: string }
  | { type: "circle"; cx: number; cy: number; r: number };

export const CUSTOM_PIECE_ICONS: Record<string, IconShape[]> = {
  archer: [
    { type: "path", d: "M7,2 C3,7 3,17 7,22", strokeWidth: 1.5 },
    { type: "path", d: "M7,2 L13,12 L7,22", strokeWidth: 1 },
    { type: "line", x1: 7, y1: 12, x2: 21, y2: 12, strokeWidth: 1.5 },
    { type: "polygon", points: "21,8.5 21,15.5 24,12" },
    { type: "path", d: "M7,12 L4,9.5 M7,12 L4,14.5", strokeWidth: 1.5 },
  ],
  siege: [
    { type: "line", x1: 4, y1: 20, x2: 12, y2: 4, strokeWidth: 1.5 },
    { type: "line", x1: 20, y1: 20, x2: 12, y2: 4, strokeWidth: 1.5 },
    { type: "line", x1: 4, y1: 20, x2: 20, y2: 20, strokeWidth: 1.5 },
    { type: "line", x1: 10, y1: 13, x2: 19, y2: 4, strokeWidth: 1.5 },
    { type: "circle", cx: 19, cy: 4, r: 1.8 },
  ],
};
