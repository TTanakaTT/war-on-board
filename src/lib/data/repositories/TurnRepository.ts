import type { Turn } from '$lib/domain/entities/Turn';
import { turnState } from '$lib/presentation/state/TurnState.svelte';

export class TurnRepository {
	static get(): Turn {
		return turnState.get();
	}
	static set(turn: Turn): void {
		turnState.set(turn);
	}
}
