import { Player } from "#lib/domain/enums/Player.ts";
import { GameApi } from "#lib/api/GameApi.ts";
import { GameApiClient } from "#lib/api/GameApiClient.ts";
import type { PanelPosition } from "#lib/domain/entities/PanelPosition.ts";
import type { AiStrength } from "#lib/domain/enums/AiStrength.ts";
import type { PieceSnapshot } from "#lib/domain/types/api.ts";
import { selectLookaheadTarget } from "#lib/services/ai/lookahead.ts";
import {
  selectStrategicPieceType,
  selectGenerationMode,
} from "#lib/services/ai/pieceGeneration.ts";
import { getStrengthProfile } from "#lib/services/ai/profiles.ts";
import type { RandomSource } from "#lib/services/ai/random.ts";
import { selectStrategicTarget } from "#lib/services/ai/targetScoring.ts";
import type { AiStrengthProfile } from "#lib/services/ai/types.ts";

export class AiService {
  /**
   * Execute an AI-controlled turn for the given player.
   *
   * 1. Assign moves for all pieces owned by the player according to the configured strength.
   * 2. Attempt to generate a piece if affordable.
   * 3. End the turn via GameApi.
   *
   * Whenever several choices share the best score, <random> picks one of them.
   */
  static doAiTurn(player: Player, strength: AiStrength, random: RandomSource) {
    const gameState = GameApi.getGameState();
    if (gameState.turn.player !== String(player) || gameState.turn.winner) return;

    const profile = getStrengthProfile(strength);

    this.assignMoves(player, profile, random);
    this.applyGenerationMode(player, profile);
    this.generatePiece(player, profile, random);
    GameApiClient.endTurn(player);
  }

  private static assignMoves(
    player: Player,
    profile: AiStrengthProfile,
    random: RandomSource,
  ): void {
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
        random,
      );

      GameApiClient.assignMove(player, piece.id, selectedTarget);
    }
  }

  private static generatePiece(
    player: Player,
    profile: AiStrengthProfile,
    random: RandomSource,
  ): void {
    while (true) {
      const gameState = GameApi.getGameState();
      const currentResources = gameState.turn.resources[String(player)] ?? 0;
      const preferredPieceType = selectStrategicPieceType(
        gameState,
        player,
        currentResources,
        profile.preferredPieceOrder,
        profile,
        random,
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
    random: RandomSource,
  ): PanelPosition {
    const targetSelectors = {
      strategic: () => selectStrategicTarget(gameState, piece, targets, profile, random),
      lookahead: () => selectLookaheadTarget(gameState, piece, targets, player, profile, random),
    } satisfies Record<AiStrengthProfile["moveSelection"], () => PanelPosition>;

    return targetSelectors[profile.moveSelection]();
  }
}
