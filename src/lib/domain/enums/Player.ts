export enum PLAYER {
	SELF = 'self',
	OPPONENT = 'opponent'
}
export type Player = (typeof PLAYER)[keyof typeof PLAYER];
