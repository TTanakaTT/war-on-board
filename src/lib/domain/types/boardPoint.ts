import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";

/**
 * A point on the board: `progress` (0–1) of the way from the panel `from` to the adjacent
 * panel `to`. A point on a panel itself has `from` equal to `to` and `progress` 0.
 */
export interface BoardPoint {
  from: PanelPosition;
  to: PanelPosition;
  progress: number;
}
