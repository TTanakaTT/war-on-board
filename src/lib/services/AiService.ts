import { GameApi } from "#lib/api/GameApi.ts";
import { GameApiClient } from "#lib/api/GameApiClient.ts";
import { AI_SUPPORT_PIECE_CAP } from "#lib/domain/config.ts";
import {
  AiStrength,
  opponentOf,
  PIECE_TYPES,
  pieceConfig,
  PieceType,
  Player,
  type GameState,
  type GenerationMode,
  type PanelPosition,
  type Piece,
} from "#lib/domain/model.ts";
import { shuffle, type RandomSource } from "#lib/services/ai/random.ts";
import {
  findHomeBase,
  findPanel,
  getSortedScoredTargets,
  sortByScoreWithRandomTies,
  type AiStrengthProfile,
} from "#lib/services/ai/scoring.ts";

const PREFERRED_PIECE_ORDER = [
  PieceType.ROOK,
  PieceType.INFANTRY,
  PieceType.NOBLE,
  PieceType.ARCHER,
  PieceType.CAVALRY,
  PieceType.HEAVY,
  PieceType.SIEGE,
];

const LEVEL_1: AiStrengthProfile = {
  moveSelection: "strategic",
  generationModeSelection: "frontline",
  lookaheadCandidateCount: 0,
  lookaheadWeight: 0,
  preferredPieceOrder: PREFERRED_PIECE_ORDER,
  targetScoring: "standard",
  pieceSelection: "standard",
  combatAssertiveness: "aggressive",
};
const LEVEL_2: AiStrengthProfile = {
  ...LEVEL_1,
  moveSelection: "lookahead",
  generationModeSelection: "adaptive-defense",
  lookaheadCandidateCount: 3,
  lookaheadWeight: 0.25,
};
const PROFILES: Record<AiStrength, AiStrengthProfile> = {
  [AiStrength.STRENGTH_1]: LEVEL_1,
  [AiStrength.STRENGTH_2]: LEVEL_2,
  [AiStrength.STRENGTH_3]: {
    ...LEVEL_2,
    targetScoring: "home-side-growth",
    pieceSelection: "infantry-balanced-support",
    combatAssertiveness: "standard",
  },
};

export class AiService {
  /**
   * Plays <player>'s turn: orders every piece, sets the generation mode, generates while
   * possible, then ends the turn exactly once. A rejected command only skips that action
   * (a rejected generation stops generating). If deciding throws, the rest is skipped, the
   * turn still ends, and the error is rethrown afterwards. Ties are broken with <random>.
   */
  static doAiTurn(player: Player, strength: AiStrength, random: RandomSource) {
    const state = GameApi.getGameState();
    if (state.turn.player !== player || state.turn.winner) return;
    const profile = PROFILES[strength] ?? LEVEL_1;

    let failure: { error: unknown } | null = null;
    try {
      this.assignMoves(player, profile, random);
      GameApiClient.setGenerationMode(player, this.selectGenerationMode(player, profile));
      this.generatePieces(player, profile, random);
    } catch (error) {
      failure = { error };
    }
    GameApiClient.endTurn(player);
    if (failure) throw failure.error;
  }

  private static assignMoves(player: Player, profile: AiStrengthProfile, random: RandomSource) {
    const ids = GameApi.getGameState()
      .pieces.filter((p) => p.player === player)
      .map((p) => p.id);
    for (const id of ids) {
      const state = GameApi.getGameState();
      const piece = state.pieces.find((p) => p.id === id);
      const targets = GameApi.getMovableTargets(id);
      if (!piece || targets.length === 0) continue;
      const target =
        profile.moveSelection === "lookahead"
          ? this.selectLookaheadTarget(state, piece, targets, player, profile, random)
          : (getSortedScoredTargets(state, piece, targets, profile, random)[0]?.target ??
            targets[0]);
      GameApiClient.assignMove(player, id, target);
    }
  }

  /** Re-scores the best candidates by simulating the move and the end of the turn. */
  private static selectLookaheadTarget(
    state: GameState,
    piece: Piece,
    targets: PanelPosition[],
    player: Player,
    profile: AiStrengthProfile,
    random: RandomSource,
  ): PanelPosition {
    const candidates = getSortedScoredTargets(state, piece, targets, profile, random)
      .slice(0, profile.lookaheadCandidateCount)
      .map(({ target, score }) => ({
        target,
        score: score + this.simulate(state, player, piece.id, target) * profile.lookaheadWeight,
      }));
    return sortByScoreWithRandomTies(candidates, random)[0]?.target ?? targets[0];
  }

  private static simulate(
    state: GameState,
    player: Player,
    pieceId: number,
    target: PanelPosition,
  ): number {
    const result = GameApi.withTemporaryGameState(state, () => {
      if (!GameApi.assignMove(player, pieceId, target).ok) return Number.NEGATIVE_INFINITY;
      if (!GameApi.endTurn(player).ok) return Number.NEGATIVE_INFINITY;
      return this.scoreBoard(GameApi.getGameState(), player);
    });
    return result.ok ? result.value : Number.NEGATIVE_INFINITY;
  }

  static scoreBoard(state: GameState, player: Player): number {
    if (state.turn.winner === player) return 5000;
    if (state.turn.winner === opponentOf(player)) return -5000;
    const sign = (owner: Player) => (owner === player ? 1 : owner === Player.UNKNOWN ? 0 : -1);
    const typeValue = (p: Piece) =>
      p.pieceType === PieceType.ROOK ? 18 : p.pieceType === PieceType.INFANTRY ? 16 : 12;

    const pieces = state.pieces.reduce(
      (sum, p) =>
        sum + (p.player === player ? 1 : -1) * (typeValue(p) + p.hp * 2 + p.stackCount * 3),
      0,
    );
    const panels = state.panels.reduce(
      (sum, p) => sum + sign(p.player) * (8 + p.resource * 4 + p.wall * 2),
      0,
    );
    const homes = state.homeBases.reduce((sum, h) => {
      const panel = findPanel(state, h.panelPosition);
      return panel ? sum + (h.player === player ? 1 : -1) * panel.wall * 3 : sum;
    }, 0);
    return pieces + panels + homes;
  }

  private static generatePieces(player: Player, profile: AiStrengthProfile, random: RandomSource) {
    for (;;) {
      const pieceType = this.selectPieceType(player, profile, random);
      if (!pieceType || !GameApiClient.generatePiece(player, pieceType).ok) return;
    }
  }

  /** First missing Noble/Infantry/Rook, else the least numerous affordable type. */
  private static selectPieceType(
    player: Player,
    profile: AiStrengthProfile,
    random: RandomSource,
  ): PieceType | null {
    const state = GameApi.getGameState();
    const resources = state.turn.resources[player] ?? 0;
    const counts = Object.fromEntries(PIECE_TYPES.map((t) => [t, 0])) as Record<PieceType, number>;
    for (const p of state.pieces) if (p.player === player) counts[p.pieceType] += 1;

    const available = profile.preferredPieceOrder.filter(
      (type) =>
        pieceConfig(type).cost <= resources &&
        GameApi.canGenerate(player, type) &&
        (profile.pieceSelection !== "infantry-balanced-support" ||
          type === PieceType.INFANTRY ||
          (counts[type] < AI_SUPPORT_PIECE_CAP && counts[type] <= counts.infantry)),
    );
    if (available.length === 0) return null;
    for (const first of [PieceType.NOBLE, PieceType.INFANTRY, PieceType.ROOK]) {
      if (counts[first] === 0 && available.includes(first)) return first;
    }
    return shuffle(available, random).sort((a, b) => counts[a] - counts[b])[0];
  }

  /** "adaptive-defense" generates at the rear while an enemy is on its home side. */
  private static selectGenerationMode(player: Player, profile: AiStrengthProfile): GenerationMode {
    if (profile.generationModeSelection === "frontline") return "front";
    const state = GameApi.getGameState();
    const home = findHomeBase(state, player)?.panelPosition;
    const enemyHome = findHomeBase(state, opponentOf(player))?.panelPosition;
    if (!home || !enemyHome) return "front";
    const intruded = state.pieces.some(
      (p) =>
        p.player !== player &&
        Math.abs(p.panelPosition.horizontalLayer - home.horizontalLayer) <
          Math.abs(p.panelPosition.horizontalLayer - enemyHome.horizontalLayer),
    );
    return intruded ? "rear" : "front";
  }
}
