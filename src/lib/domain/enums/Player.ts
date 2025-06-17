import { EnumClass } from './EnumFactory';

enum PLAYER {
	SELF = 'self',
	OPPONENT = 'opponent'
}

@EnumClass(PLAYER)
export class Player {
	static SELF: Player;
	static OPPONENT: Player;

	private readonly _value: PLAYER;
	constructor(value: PLAYER) {
		this._value = value;
	}
}
