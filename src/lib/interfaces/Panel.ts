import type { PanelState } from '$lib/enums/PanelStates';

export interface Panel {
	horizontalLayer: number;
	verticalLayer: number;
	panelState: PanelState;
}
