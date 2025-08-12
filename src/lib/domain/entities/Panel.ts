import type { PanelState } from '$lib/domain/enums/PanelState';
import { Player } from '../enums/Player';
import type { PanelPosition } from './PanelPosition';

export class Panel {
	panelPosition: PanelPosition;
	panelState: PanelState;
	player: Player;
	resource: number;
	castle: number;

	constructor({
		panelPosition,
		panelState,
		player = Player.UNKNOWN,
		resource = 0,
		castle = 0
	}: {
		panelPosition: PanelPosition;
		panelState: PanelState;
		player?: Player;
		resource?: number;
		castle?: number;
	}) {
		this.panelPosition = panelPosition;
		this.panelState = panelState;
		this.player = player;
		this.resource = resource;
		this.castle = castle;
	}

	equals(other: Panel): boolean {
		return this.panelPosition.equals(other.panelPosition) && this.panelState === other.panelState;
	}
}
