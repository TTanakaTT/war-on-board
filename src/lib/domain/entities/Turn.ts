import type { Player } from "$lib/domain/enums/Player";

export type GenerationMode = "front" | "rear";

export interface Turn {
  num: number;
  player: Player;
  resources: Record<string, number>;
  maxPiecesPerPanel: Record<string, number>;
  generationMode: Record<string, GenerationMode>;
  winner: Player | null;
}
