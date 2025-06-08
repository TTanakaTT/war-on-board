export enum PANELSTATE {
	UNOCCUPIED = 'unoccupied',
	OCCUPIED = 'occupied',
	SELECTED = 'selected',
	MOVABLE = 'movable',
	IMMOVABLE = 'immovable'
}
export type PanelState = (typeof PANELSTATE)[keyof typeof PANELSTATE];
