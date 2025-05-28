import { writable, derived, type Readable } from 'svelte/store';
import type { Piece } from '$lib/interfaces/Piece';

export const pieces = writable<Piece[]>([]);

function getPieceNames(horizontalLayer: number, verticalLayer: number): Readable<string[]> {
	return derived(pieces, ($pieces) => {
		if (!$pieces?.length) {
			return [];
		}
		return $pieces
			.filter((x) => x.horizontalLayer === horizontalLayer && x.verticalLayer === verticalLayer)
			.map((y) => y.pieceName);
	});
}
function create(piece: Piece): void {
	pieces.update((pieces) => pieces.concat(piece));
}
function remove(piece: Piece): void {
	pieces.update((pieces) =>
		pieces.filter(
			(x) =>
				x.horizontalLayer !== piece.horizontalLayer ||
				x.verticalLayer !== piece.verticalLayer ||
				x.pieceName !== piece.pieceName
		)
	);
}

export const piecesStore = {
	getPieceNames: getPieceNames,
	create: create,
	remove: remove
};
