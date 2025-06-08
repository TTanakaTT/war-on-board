export enum PIECETYPE {
	KNIGHT = 'knight'
}
export type PieceType = (typeof PIECETYPE)[keyof typeof PIECETYPE];
