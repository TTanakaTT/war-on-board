import type { Player } from "$lib/domain/enums/Player";
import type { PanelPosition } from "./PanelPosition";

export class HomeBase {
  player: Player;
  panelPosition: PanelPosition;

  constructor({ player, panelPosition }: { player: Player; panelPosition: PanelPosition }) {
    this.player = player;
    this.panelPosition = panelPosition;
  }
}
