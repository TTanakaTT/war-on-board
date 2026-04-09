import { LayerRepository } from "$lib/data/repositories/LayerRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PANEL_HEIGHT, PANEL_MARGIN } from "$lib/presentation/constants/UiConstants";

export class BoardLayoutService {
  static readonly HEIGHT = PANEL_HEIGHT;
  static readonly PANEL_MARGIN = PANEL_MARGIN;
  static readonly VERTICAL_SPACING = PANEL_HEIGHT + PANEL_MARGIN;

  static get layer() {
    return LayerRepository.get();
  }

  static get hypotenuseHorizontalLength() {
    return this.HEIGHT / 2 / Math.sqrt(3);
  }

  static get horizontalSideLength() {
    return this.HEIGHT / Math.sqrt(3);
  }

  static get horizontalLength() {
    return this.horizontalSideLength + this.hypotenuseHorizontalLength;
  }

  static get horizontalMargin() {
    return (this.HEIGHT * 0.1 * Math.sqrt(3)) / 2;
  }

  static get boardWidth() {
    const layer = this.layer;
    const hypo = this.hypotenuseHorizontalLength;
    const margin = this.horizontalMargin;
    const horizLength = 3 * hypo;
    return horizLength * (layer * 2 - 1) + margin * (layer * 2 - 2) + hypo;
  }

  static get boardHeight() {
    const layer = this.layer;
    // Tallest column is center (hl=0), height is layer * (HEIGHT + PANEL_MARGIN)
    return layer * (this.HEIGHT + this.PANEL_MARGIN) + this.PANEL_MARGIN;
  }

  static getCoordinates(pos: PanelPosition) {
    const layer = this.layer;
    const hl = pos.horizontalLayer;
    const vl = pos.verticalLayer;
    const hypo = this.hypotenuseHorizontalLength;
    const margin = this.horizontalMargin;

    const i = hl + layer - 1;
    const horizLength = 3 * hypo;
    // Match original float-based spacing:
    const x = i * (horizLength + margin) + 2 * hypo;

    const topOffset = Math.abs(hl) * (this.HEIGHT / 2) * 1.1;
    const y = topOffset + vl * (this.HEIGHT + this.PANEL_MARGIN) + this.HEIGHT / 2 + 5;

    return { x, y };
  }
}
