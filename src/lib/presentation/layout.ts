import type { BoardPoint, PanelPosition, Piece } from "#lib/domain/model.ts";
import { isInTransit } from "#lib/domain/model.ts";
import { PieceService } from "#lib/services/PieceService.ts";
import { LayerRepository, PiecesRepository } from "#lib/store.svelte.ts";

export const PANEL_HEIGHT = 100;
export const PANEL_MARGIN = 10;
export const DESKTOP_NAVIGATION_BREAKPOINT_PX = 1024;
export const MOBILE_GAME_HEADER_HEIGHT_PX = 112;
export const MOBILE_BOARD_VIEWPORT_GUTTER_PX = 32;
/** Pixel offset shared by board coordinates and panel placement. */
export const BOARD_PANEL_VERTICAL_PIXEL_OFFSET = 5;
const BOARD_HORIZONTAL_MARGIN_RATIO = 0.1;
const BOARD_COLUMN_VERTICAL_OFFSET_RATIO = 1.1;
const PIECE_TOKEN_CENTER_SPACING = 38;
export const PIECE_PREVIEW_ANIMATION_MS = 1600;

// HP gauges on a piece token: one gauge per unit, stacked behind the front unit's gauge.
export const HP_GAUGE_WIDTH_PX = 20;
export const HP_GAUGE_HEIGHT_PX = 4;
/** How far each gauge behind peeks out above the one in front. */
export const HP_GAUGE_STACK_OFFSET_PX = 2;
/** Gauges stop growing here; the badge still shows the full stackCount. */
export const HP_GAUGE_MAX_VISIBLE = 3;
export const HP_GAUGE_FILL_MS = 300;
/** The damaged part lingers in the damage color before shrinking. */
export const HP_GAUGE_TRAIL_DELAY_MS = 250;
export const HP_GAUGE_TRAIL_MS = 400;
/** A lost unit's gauge empties, then falls away. */
export const HP_GAUGE_DRAIN_MS = 350;
export const HP_GAUGE_DROP_MS = 250;
export const HP_GAUGE_DROP_DISTANCE_PX = 6;
export const HP_GAUGE_SHIFT_MS = 200;
export const HP_GAUGE_JOIN_MS = 300;
export const HP_GAUGE_JOIN_STAGGER_MS = 100;
export const HP_GAUGE_JOIN_DISTANCE_PX = 6;
export const STACK_BADGE_POP_MS = 250;
export const STACK_BADGE_POP_SCALE = 1.6;
export const DRAWER_WIDTH_TRANSITION_MS = 200;

// Drawer widths in Tailwind spacing units. Chrome = borders (0.5) + padding (p-4: 8), plus the
// desktop game drawer's edge-toggle gutter (pr-5: 5). Info cards keep the same width everywhere.
export const DEFAULT_DRAWER_WIDTH_UNITS = 64;
const GAME_DRAWER_CHROME_UNITS = 0.5 + 5 + 8;
const MOBILE_DRAWER_CHROME_UNITS = 0.5 + 8;
const INFO_CARD_WIDTH_UNITS = DEFAULT_DRAWER_WIDTH_UNITS - GAME_DRAWER_CHROME_UNITS;
const INFO_CARD_GAP_UNITS = 4;
export const EXPANDED_GAME_DRAWER_WIDTH_UNITS =
  GAME_DRAWER_CHROME_UNITS + 2 * INFO_CARD_WIDTH_UNITS + INFO_CARD_GAP_UNITS;
export const MOBILE_DRAWER_WIDTH_UNITS = MOBILE_DRAWER_CHROME_UNITS + INFO_CARD_WIDTH_UNITS;

// Match history chart, in px.
export const HISTORY_CHART_HEIGHT_PX = 240;
export const HISTORY_CHART_PADDING_PX = { top: 8, bottom: 36, axis: 44, edge: 12 };
export const HISTORY_CHART_TARGET_Y_TICKS = 4;
export const HISTORY_CHART_MIN_X_TICK_SPACING_PX = 40;
export const HISTORY_CHART_LINE_WIDTH_PX = 2;
export const HISTORY_CHART_DASH_ARRAY = "6 4";
export const HISTORY_CHART_POINT_RADIUS_PX = 4;
export const HISTORY_CHART_LABEL_GAP_PX = 6;
export const HISTORY_CHART_LABEL_ICON_PX = 16;
export const HISTORY_CHART_LEGEND_LINE_PX = 28;
export const HISTORY_CHART_LEGEND_LINE_WIDTH_PX = 3.5;
export const HISTORY_CHART_LEGEND_DASH_ARRAY = "8 5";

export class BoardLayout {
  static readonly HEIGHT = PANEL_HEIGHT;
  static readonly PANEL_MARGIN = PANEL_MARGIN;

  static get hypotenuseHorizontalLength() {
    return this.HEIGHT / 2 / Math.sqrt(3);
  }

  static get horizontalSideLength() {
    return this.HEIGHT / Math.sqrt(3);
  }

  static get horizontalMargin() {
    return (this.HEIGHT * BOARD_HORIZONTAL_MARGIN_RATIO * Math.sqrt(3)) / 2;
  }

  static get boardWidth() {
    const layer = LayerRepository.get();
    const hypo = this.hypotenuseHorizontalLength;
    return 3 * hypo * (layer * 2 - 1) + this.horizontalMargin * (layer * 2 - 2) + hypo;
  }

  static get boardHeight() {
    return LayerRepository.get() * (this.HEIGHT + this.PANEL_MARGIN) + this.PANEL_MARGIN;
  }

  static getCoordinates(pos: PanelPosition) {
    const hl = pos.horizontalLayer;
    const hypo = this.hypotenuseHorizontalLength;
    const column = hl + LayerRepository.get() - 1;
    const x = column * (3 * hypo + this.horizontalMargin) + 2 * hypo;
    const topOffset = Math.abs(hl) * (this.HEIGHT / 2) * BOARD_COLUMN_VERTICAL_OFFSET_RATIO;
    const y =
      topOffset +
      pos.verticalLayer * (this.HEIGHT + this.PANEL_MARGIN) +
      this.HEIGHT / 2 +
      BOARD_PANEL_VERTICAL_PIXEL_OFFSET;
    return { x, y };
  }

  static getPointCoordinates(point: BoardPoint) {
    const from = this.getCoordinates(point.from);
    const to = this.getCoordinates(point.to);
    return {
      x: from.x + (to.x - from.x) * point.progress,
      y: from.y + (to.y - from.y) * point.progress,
    };
  }
}

/** Pieces drawn in a panel's token row; pieces in transit are drawn between panels. */
export const getPanelRowPieces = (position: PanelPosition): Piece[] =>
  PiecesRepository.getPiecesByPosition(position).filter((p) => !isInTransit(p));

export function getPieceTokenCoordinates(piece: Piece): { x: number; y: number } {
  const coordinates = BoardLayout.getPointCoordinates(PieceService.currentBoardPoint(piece));
  if (isInTransit(piece)) return coordinates;
  const row = getPanelRowPieces(piece.panelPosition);
  const index = row.findIndex((p) => p.id === piece.id);
  return {
    x: coordinates.x + (index - (row.length - 1) / 2) * PIECE_TOKEN_CENTER_SPACING,
    y: coordinates.y,
  };
}
