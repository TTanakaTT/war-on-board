import { EnumClass } from './EnumFactory';

enum PANELSTATE {
	UNOCCUPIED = 'unoccupied',
	OCCUPIED = 'occupied',
	SELECTED = 'selected',
	MOVABLE = 'movable',
	IMMOVABLE = 'immovable'
}

@EnumClass(PANELSTATE)
export class PanelState {
	static UNOCCUPIED: PanelState;
	static OCCUPIED: PanelState;
	static SELECTED: PanelState;
	static MOVABLE: PanelState;
	static IMMOVABLE: PanelState;

	private readonly _value: PANELSTATE;
	constructor(value: PANELSTATE) {
		this._value = value;
	}
}
