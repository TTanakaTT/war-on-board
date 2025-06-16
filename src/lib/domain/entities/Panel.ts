import type { PanelState } from '$lib/domain/enums/PanelState';
import type { PanelPosition } from './PanelPosition';

export class Panel {
	panelPosition: PanelPosition;
	panelState: PanelState;

	constructor({
		panelPosition,
		panelState
	}: {
		panelPosition: PanelPosition;
		panelState: PanelState;
	}) {
		this.panelPosition = panelPosition;
		this.panelState = panelState;
	}

	equals(other: Panel): boolean {
		return this.panelPosition.equals(other.panelPosition) && this.panelState === other.panelState;
	}
}
