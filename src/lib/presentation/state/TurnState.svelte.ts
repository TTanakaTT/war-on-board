import type { Turn } from '$lib/domain/entities/Turn';
import { PLAYER } from '$lib/domain/enums/Player';

let _turn = $state<Turn>({ num: 1, player: PLAYER.SELF });

export function get(): Turn {
	return _turn;
}
export function set(turn: Turn): void {
	_turn = turn;
}

export const turnState = {
	get,
	set
};
