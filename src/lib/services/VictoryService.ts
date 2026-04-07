import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { HomeBaseRepository } from "$lib/data/repositories/HomeBaseRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { Player } from "$lib/domain/enums/Player";

export class VictoryService {
  /**
   * Symmetric victory check: if a player's home base is occupied by the opponent, the opponent wins.
   * Returns the winning player or null if no winner.
   */
  static checkVictory(): Player | null {
    const homeBases = HomeBaseRepository.getAll();

    for (const homeBase of homeBases) {
      const panel = PanelRepository.find(homeBase.panelPosition);
      if (!panel) continue;

      // If the home base panel is owned by the opposing player, that opposing player wins
      if (panel.player !== homeBase.player && panel.player !== Player.UNKNOWN) {
        return panel.player;
      }
    }
    return null;
  }

  static applyVictory(): void {
    const winner = this.checkVictory();
    if (winner) {
      const turn = TurnRepository.get();
      TurnRepository.set({ ...turn, winner });
    }
  }
}
