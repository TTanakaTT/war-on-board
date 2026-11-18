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
   *
   * Rejected commands (`ok: false`) only give up that one action:
   * - `assignMove`: the piece keeps its current orders and the next piece is handled.
   * - `setGenerationMode`: ignored; the turn carries on.
   * - `generatePiece`: stops generating for the rest of this turn.
   *
   * If deciding the turn (assigning moves, choosing the generation mode, generating pieces)
   * throws, the remaining decisions are skipped, while the orders and pieces already issued
   * stay as they are. `endTurn` is then called exactly once either way, without retrying:
   * - When it is rejected, this returns quietly; MatchService decides whether to halt.
   * - When it throws, that exception propagates (a decision exception is dropped).
   * - Otherwise the decision exception, if any, is rethrown after the turn has ended.
   */
  static doAiTurn(player: Player, strength: AiStrength, random: RandomSource) {
    const gameState = GameApi.getGameState();
    if (gameState.turn.player !== String(player) || gameState.turn.winner) return;

    const profile = getStrengthProfile(strength);

    let decisionFailure: { error: unknown } | null = null;
    try {
      this.assignMoves(player, profile, random);
      this.applyGenerationMode(player, profile);
      this.generatePiece(player, profile, random);
    } catch (error) {
      decisionFailure = { error };
    }

    GameApiClient.endTurn(player);

    if (decisionFailure) {
      throw decisionFailure.error;
    }
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

      const assignResult = GameApiClient.assignMove(player, piece.id, selectedTarget);
      if (!assignResult.ok) {
        // Rejected: leave this piece with its current orders and handle the next one.
        continue;
      }
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
        // Rejected: give up generating for the rest of this turn.
        return;
      }
    }
  }

  private static applyGenerationMode(player: Player, profile: AiStrengthProfile): void {
    const gameState = GameApi.getGameState();
    const generationMode = selectGenerationMode(gameState, player, profile);
    const modeResult = GameApiClient.setGenerationMode(player, generationMode);
    if (!modeResult.ok) {
      // Rejected: keep the current generation mode and carry on with the turn.
      return;
    }
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
