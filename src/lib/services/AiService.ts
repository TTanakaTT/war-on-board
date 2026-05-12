import { Player } from "$lib/domain/enums/Player";
import { GameApi } from "$lib/api/GameApi";
import { GameApiClient } from "$lib/api/GameApiClient";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import type { PieceSnapshot } from "$lib/domain/types/api";
import { selectLookaheadTarget } from "$lib/services/ai/lookahead";
import { selectStrategicPieceType, selectGenerationMode } from "$lib/services/ai/pieceGeneration";
import { getStrengthProfile } from "$lib/services/ai/profiles";
import { selectStrategicTarget } from "$lib/services/ai/targetScoring";
import type { AiStrengthProfile } from "$lib/services/ai/types";

export class AiService {
  /**
   * Execute an AI-controlled turn for the given player.
   *
   * 1. Assign moves for all pieces owned by the player according to the configured strength.
   * 2. Attempt to generate a piece if affordable.
   * 3. End the turn via GameApi.
   */
  static doAiTurn(player: Player, strength: AiStrength = AiStrength.STRENGTH_1) {
    const gameState = GameApi.getGameState();
    if (gameState.turn.player !== String(player) || gameState.turn.winner) return;

    const profile = getStrengthProfile(strength);

    this.assignMoves(player, profile);
    this.applyGenerationMode(player, profile);
    this.generatePiece(player, profile);
    GameApiClient.endTurn(player);
  }

  private static assignMoves(player: Player, profile: AiStrengthProfile): void {
    const pieces = GameApi.getGameState().pieces.filter((piece) => piece.player === String(player));

    for (const piece of pieces) {
      const latestGameState = GameApi.getGameState();
      const latestPiece = latestGameState.pieces.find((candidate) => candidate.id === piece.id);
      if (!latestPiece) continue;

      const targets = GameApi.getMovableTargets(piece.id);
      if (targets.length === 0) continue;

      const selectedTarget = this.selectTarget(
        latestGameState,
        latestPiece,
        targets,
        player,
        profile,
      );

      GameApiClient.assignMove(player, piece.id, selectedTarget);
    }
  }

  private static generatePiece(player: Player, profile: AiStrengthProfile): void {
    while (true) {
      const gameState = GameApi.getGameState();
      const currentResources = gameState.turn.resources[String(player)] ?? 0;
      const preferredPieceType = selectStrategicPieceType(
        gameState,
        player,
        currentResources,
        profile.preferredPieceOrder,
        profile,
      );

      if (!preferredPieceType) {
        return;
      }

      const generationResult = GameApiClient.generatePiece(player, preferredPieceType);
      if (!generationResult.ok) {
        return;
      }
    }
  }

  private static applyGenerationMode(player: Player, profile: AiStrengthProfile): void {
    const gameState = GameApi.getGameState();
    const generationMode = selectGenerationMode(gameState, player, profile);
    GameApiClient.setGenerationMode(player, generationMode);
  }

  private static selectTarget(
    gameState: ReturnType<typeof GameApi.getGameState>,
    piece: PieceSnapshot,
    targets: PanelPosition[],
    player: Player,
    profile: AiStrengthProfile,
  ): PanelPosition {
    const targetSelectors = {
      strategic: () => selectStrategicTarget(gameState, piece, targets, profile),
      lookahead: () => selectLookaheadTarget(gameState, piece, targets, player, profile),
    } satisfies Record<AiStrengthProfile["moveSelection"], () => PanelPosition>;

    return targetSelectors[profile.moveSelection]();
  }
}
