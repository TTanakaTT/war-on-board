import { Player } from "$lib/domain/enums/Player";
import { PieceType } from "$lib/domain/enums/PieceType";
import { GameApi } from "$lib/api/GameApi";
import { GameStateHistoryRepository } from "$lib/data/repositories/GameStateHistoryRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { GenerationMode } from "$lib/domain/entities/Turn";
import type {
  GameStateSnapshot,
  HomeBaseSnapshot,
  PanelPositionSnapshot,
  PanelSnapshot,
  PieceSnapshot,
} from "$lib/domain/types/api";
import { AiStrength } from "$lib/domain/enums/AiStrength";

type MoveSelectionStrategy = "strategic" | "lookahead";
type GenerationModeSelectionStrategy = "frontline" | "adaptive-defense";

interface AiStrengthProfile {
  moveSelection: MoveSelectionStrategy;
  generationModeSelection: GenerationModeSelectionStrategy;
  lookaheadCandidateCount: number;
  lookaheadWeight: number;
  preferredPieceOrder: PieceType[];
}

interface PieceCombatStats {
  attackPowerAgainstPiece: number;
  attackPowerAgainstWall: number;
  canAttack: boolean;
  mergeable: boolean;
}

interface ScoredTarget {
  score: number;
  target: PanelPosition;
  laneLoad: number;
  laneShift: number;
}

const DEFAULT_PREFERRED_PIECE_ORDER = [PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP];

const AI_STRENGTH_PROFILES: Record<AiStrength, AiStrengthProfile> = {
  [AiStrength.STRENGTH_1]: {
    moveSelection: "strategic",
    generationModeSelection: "frontline",
    lookaheadCandidateCount: 0,
    lookaheadWeight: 0,
    preferredPieceOrder: DEFAULT_PREFERRED_PIECE_ORDER,
  },
  [AiStrength.STRENGTH_2]: {
    moveSelection: "lookahead",
    generationModeSelection: "adaptive-defense",
    lookaheadCandidateCount: 3,
    lookaheadWeight: 0.25,
    preferredPieceOrder: DEFAULT_PREFERRED_PIECE_ORDER,
  },
};

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

    const profile = this.getStrengthProfile(strength);

    this.assignMoves(player, profile);
    this.applyGenerationMode(player, profile);
    this.generatePiece(player, profile);
    GameApi.endTurn(player);
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

      GameApi.assignMove(player, piece.id, selectedTarget);
    }
  }

  private static generatePiece(player: Player, profile: AiStrengthProfile): void {
    while (true) {
      const gameState = GameApi.getGameState();
      const currentResources = gameState.turn.resources[String(player)] ?? 0;
      const preferredPieceType = this.selectStrategicPieceType(
        gameState,
        player,
        currentResources,
        profile.preferredPieceOrder,
      );

      if (!preferredPieceType) {
        return;
      }

      const generationResult = GameApi.generatePiece(player, preferredPieceType);
      if (!generationResult.ok) {
        return;
      }
    }
  }

  private static applyGenerationMode(player: Player, profile: AiStrengthProfile): void {
    const gameState = GameApi.getGameState();
    const generationMode = this.selectGenerationMode(gameState, player, profile);
    GameApi.setGenerationMode(player, generationMode);
  }

  private static selectStrategicPieceType(
    gameState: GameStateSnapshot,
    player: Player,
    currentResources: number,
    preferredOrder: PieceType[],
  ): PieceType | null {
    const availablePieceTypes = this.getAffordablePieceTypes(
      player,
      currentResources,
      preferredOrder,
    );
    if (availablePieceTypes.length === 0) {
      return null;
    }

    const pieceTypeCounts = this.countPieceTypes(gameState, player);

    if (pieceTypeCounts.bishop === 0 && availablePieceTypes.includes(PieceType.BISHOP)) {
      return PieceType.BISHOP;
    }

    if (pieceTypeCounts.knight === 0 && availablePieceTypes.includes(PieceType.KNIGHT)) {
      return PieceType.KNIGHT;
    }

    if (pieceTypeCounts.rook === 0 && availablePieceTypes.includes(PieceType.ROOK)) {
      return PieceType.ROOK;
    }

    return availablePieceTypes.sort((left, right) => {
      const countDiff =
        pieceTypeCounts[String(left) as keyof typeof pieceTypeCounts] -
        pieceTypeCounts[String(right) as keyof typeof pieceTypeCounts];
      if (countDiff !== 0) {
        return countDiff;
      }

      return preferredOrder.indexOf(left) - preferredOrder.indexOf(right);
    })[0];
  }

  private static getStrengthProfile(strength: AiStrength): AiStrengthProfile {
    return AI_STRENGTH_PROFILES[strength] ?? AI_STRENGTH_PROFILES[AiStrength.STRENGTH_1];
  }

  private static getAffordablePieceTypes(
    player: Player,
    currentResources: number,
    pieceTypes: PieceType[],
  ): PieceType[] {
    return pieceTypes.filter(
      (pieceType) =>
        pieceType.config.cost <= currentResources && GameApi.canGenerate(player, pieceType),
    );
  }

  private static countPieceTypes(gameState: GameStateSnapshot, player: Player) {
    return gameState.pieces
      .filter((piece) => piece.player === String(player))
      .reduce(
        (counts, piece) => {
          counts[piece.pieceType] += 1;
          return counts;
        },
        {
          knight: 0,
          rook: 0,
          bishop: 0,
        },
      );
  }

  private static selectRandomTarget(targets: PanelPosition[]): PanelPosition {
    return targets[Math.floor(Math.random() * targets.length)];
  }

  private static selectTarget(
    gameState: GameStateSnapshot,
    piece: PieceSnapshot,
    targets: PanelPosition[],
    player: Player,
    profile: AiStrengthProfile,
  ): PanelPosition {
    const targetSelectors: Record<MoveSelectionStrategy, () => PanelPosition> = {
      strategic: () => this.selectStrategicTarget(gameState, piece, targets),
      lookahead: () => this.selectLookaheadTarget(gameState, piece, targets, player, profile),
    };

    return targetSelectors[profile.moveSelection]();
  }

  private static selectGenerationMode(
    gameState: GameStateSnapshot,
    player: Player,
    profile: AiStrengthProfile,
  ): GenerationMode {
    const generationModeSelectors: Record<GenerationModeSelectionStrategy, () => GenerationMode> = {
      frontline: () => "front",
      "adaptive-defense": () =>
        this.hasEnemyIntrusionOnHomeSide(gameState, player) ? "rear" : "front",
    };

    return generationModeSelectors[profile.generationModeSelection]();
  }

  private static selectStrategicTarget(
    gameState: GameStateSnapshot,
    piece: PieceSnapshot,
    targets: PanelPosition[],
  ): PanelPosition {
    const scoredTargets = this.getSortedScoredTargets(gameState, piece, targets);

    return scoredTargets[0]?.target ?? targets[0];
  }

  private static selectLookaheadTarget(
    gameState: GameStateSnapshot,
    piece: PieceSnapshot,
    targets: PanelPosition[],
    player: Player,
    profile: AiStrengthProfile,
  ): PanelPosition {
    const topCandidates = this.getSortedScoredTargets(gameState, piece, targets).slice(
      0,
      profile.lookaheadCandidateCount,
    );

    const lookaheadTargets = topCandidates.map((candidate) => ({
      target: candidate.target,
      score:
        candidate.score +
        this.simulateTargetOutcome(gameState, player, piece.id, candidate.target) *
          profile.lookaheadWeight,
      laneLoad: candidate.laneLoad,
      laneShift: candidate.laneShift,
    }));

    lookaheadTargets.sort((left, right) => this.compareScoredTargets(left, right, player));

    return lookaheadTargets[0]?.target ?? targets[0];
  }

  private static getSortedScoredTargets(
    gameState: GameStateSnapshot,
    piece: PieceSnapshot,
    targets: PanelPosition[],
  ): ScoredTarget[] {
    const scoredTargets: ScoredTarget[] = targets.map((target) => ({
      target,
      score: this.scoreTarget(gameState, piece, target),
      laneLoad: this.countLaneLoad(gameState, piece.player, target.verticalLayer, piece.id),
      laneShift: Math.abs(target.verticalLayer - piece.initialPosition.verticalLayer),
    }));

    scoredTargets.sort((left, right) => this.compareScoredTargets(left, right, piece.player));

    return scoredTargets;
  }

  private static countLaneLoad(
    gameState: GameStateSnapshot,
    player: PieceSnapshot["player"],
    verticalLayer: number,
    excludedPieceId: number,
  ): number {
    return gameState.pieces.filter((piece) => {
      if (piece.id === excludedPieceId || piece.player !== player) {
        return false;
      }

      const plannedPosition = piece.targetPosition ?? piece.panelPosition;
      return plannedPosition.verticalLayer === verticalLayer;
    }).length;
  }

  private static compareScoredTargets(
    left: ScoredTarget,
    right: ScoredTarget,
    player: Player | PieceSnapshot["player"],
  ): number {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.target.horizontalLayer !== right.target.horizontalLayer) {
      return player === Player.SELF || player === "self"
        ? right.target.horizontalLayer - left.target.horizontalLayer
        : left.target.horizontalLayer - right.target.horizontalLayer;
    }

    if (left.laneLoad !== right.laneLoad) {
      return left.laneLoad - right.laneLoad;
    }

    if (left.laneShift !== right.laneShift) {
      return left.laneShift - right.laneShift;
    }

    return 0;
  }

  private static simulateTargetOutcome(
    gameState: GameStateSnapshot,
    player: Player,
    pieceId: number,
    target: PanelPosition,
  ): number {
    const historySnapshot = GameApi.getGameStateHistory();

    try {
      const loadResult = GameApi.loadGameState(gameState);
      if (!loadResult.ok) {
        return Number.NEGATIVE_INFINITY;
      }

      const assignResult = GameApi.assignMove(player, pieceId, target);
      if (!assignResult.ok) {
        return Number.NEGATIVE_INFINITY;
      }

      const endTurnResult = GameApi.endTurn(player);
      if (!endTurnResult.ok) {
        return Number.NEGATIVE_INFINITY;
      }

      return this.scoreBoardState(GameApi.getGameState(), player);
    } finally {
      GameApi.loadGameState(gameState);
      GameStateHistoryRepository.setAll(historySnapshot);
    }
  }

  private static scoreBoardState(gameState: GameStateSnapshot, player: Player): number {
    const playerId = String(player);
    const opponentId = String(player === Player.SELF ? Player.OPPONENT : Player.SELF);

    if (gameState.turn.winner === playerId) {
      return 5000;
    }

    if (gameState.turn.winner === opponentId) {
      return -5000;
    }

    const pieceScore = gameState.pieces.reduce((score, piece) => {
      const direction = piece.player === playerId ? 1 : -1;
      return score + direction * this.scorePieceValue(piece);
    }, 0);

    const panelScore = gameState.panels.reduce((score, panel) => {
      if (panel.player === playerId) {
        return score + 8 + panel.resource * 4 + panel.castle * 2;
      }

      if (panel.player === opponentId) {
        return score - (8 + panel.resource * 4 + panel.castle * 2);
      }

      return score;
    }, 0);

    const homeBaseScore = gameState.homeBases.reduce((score, homeBase) => {
      const panel = this.findPanel(gameState, homeBase.panelPosition);
      if (!panel) {
        return score;
      }

      if (homeBase.player === playerId) {
        return score + panel.castle * 3;
      }

      return score - panel.castle * 3;
    }, 0);

    return pieceScore + panelScore + homeBaseScore;
  }

  private static scorePieceValue(piece: PieceSnapshot): number {
    const typeValue = piece.pieceType === "rook" ? 18 : piece.pieceType === "knight" ? 16 : 12;

    return typeValue + piece.hp * 2 + piece.stackCount * 3;
  }

  private static scoreTarget(
    gameState: GameStateSnapshot,
    piece: PieceSnapshot,
    target: PanelPosition,
  ): number {
    const panel = this.findPanel(gameState, target);
    if (!panel) {
      return Number.NEGATIVE_INFINITY;
    }

    const isStay = this.positionEquals(target, piece.initialPosition);
    if (isStay) {
      return 0;
    }

    const enemyPieces = gameState.pieces.filter(
      (candidate) =>
        candidate.player !== piece.player && this.positionEquals(candidate.panelPosition, target),
    );
    const friendlyPieces = gameState.pieces.filter(
      (candidate) =>
        candidate.id !== piece.id &&
        candidate.player === piece.player &&
        this.positionEquals(candidate.panelPosition, target),
    );
    const hasEnemyCastle =
      panel.player !== piece.player && panel.player !== "unknown" && panel.castle > 0;
    const enemyHomeBase = this.isEnemyHomeBase(gameState, piece.player, target);

    if (enemyHomeBase && panel.castle === 0 && enemyPieces.length === 0) {
      return 1000;
    }

    if (enemyPieces.length > 0 || hasEnemyCastle) {
      return this.scoreAttackTarget(piece, panel, enemyPieces, enemyHomeBase);
    }

    const pieceStats = this.getPieceCombatStats(piece);
    const canMerge =
      pieceStats.mergeable &&
      friendlyPieces.some((candidate) => candidate.pieceType === piece.pieceType);
    if (canMerge) {
      return 35 + friendlyPieces.length * 5;
    }

    if (panel.player !== piece.player) {
      return 25 + panel.resource * 4;
    }

    return 6 + friendlyPieces.length * 2;
  }

  private static hasEnemyIntrusionOnHomeSide(
    gameState: GameStateSnapshot,
    player: Player,
  ): boolean {
    const playerHomeBase = this.findHomeBase(gameState, this.toPlayerSnapshot(player));
    const opponentHomeBase = this.findHomeBase(
      gameState,
      this.toPlayerSnapshot(this.getOpponentPlayer(player)),
    );

    if (!playerHomeBase || !opponentHomeBase) {
      return false;
    }

    return gameState.pieces.some((piece) => {
      if (piece.player === String(player)) {
        return false;
      }

      const distanceToPlayerHome = Math.abs(
        piece.panelPosition.horizontalLayer - playerHomeBase.panelPosition.horizontalLayer,
      );
      const distanceToOpponentHome = Math.abs(
        piece.panelPosition.horizontalLayer - opponentHomeBase.panelPosition.horizontalLayer,
      );

      return distanceToPlayerHome < distanceToOpponentHome;
    });
  }

  private static scoreAttackTarget(
    piece: PieceSnapshot,
    panel: PanelSnapshot,
    enemyPieces: PieceSnapshot[],
    enemyHomeBase: boolean,
  ): number {
    const pieceStats = this.getPieceCombatStats(piece);
    if (!pieceStats.canAttack) {
      return Number.NEGATIVE_INFINITY;
    }

    const totalEnemyHp = enemyPieces.reduce((sum, enemyPiece) => sum + enemyPiece.hp, 0);
    const totalEnemyAttack = enemyPieces.reduce(
      (sum, enemyPiece) => sum + this.getPieceCombatStats(enemyPiece).attackPowerAgainstPiece,
      0,
    );

    let score = panel.player !== piece.player ? 12 + panel.resource * 2 : 0;

    if (panel.castle > 0) {
      if (pieceStats.attackPowerAgainstWall <= 0) {
        return -120;
      }

      const remainingCastle = Math.max(0, panel.castle - pieceStats.attackPowerAgainstWall);
      const overflowRatio =
        Math.max(0, pieceStats.attackPowerAgainstWall - panel.castle) /
        pieceStats.attackPowerAgainstWall;
      const overflowPieceDamage = pieceStats.attackPowerAgainstPiece * overflowRatio;

      score += 18 - remainingCastle * 8 + overflowPieceDamage * 4;

      if (remainingCastle === 0 && enemyPieces.length === 0) {
        return enemyHomeBase ? 1000 : score + 80;
      }

      if (enemyPieces.length > 0) {
        score += (overflowPieceDamage - totalEnemyHp) * 6;
        if (overflowPieceDamage >= totalEnemyHp) {
          score += 40;
        }
        if (totalEnemyAttack >= piece.hp && overflowPieceDamage < totalEnemyHp) {
          score -= 120;
        }
      }

      return score;
    }

    const attackMargin = pieceStats.attackPowerAgainstPiece - totalEnemyHp;
    const survivalMargin = piece.hp - totalEnemyAttack;

    score += attackMargin * 8 + survivalMargin * 3;

    if (attackMargin >= 0) {
      score += enemyHomeBase ? 1000 : 70;
    }

    if (survivalMargin <= 0 && attackMargin < 0) {
      score -= 140;
    }

    return score;
  }

  private static findPanel(
    gameState: GameStateSnapshot,
    target: PanelPositionSnapshot | { horizontalLayer: number; verticalLayer: number },
  ): PanelSnapshot | undefined {
    return gameState.panels.find((panel) => this.positionEquals(panel.panelPosition, target));
  }

  private static findHomeBase(
    gameState: GameStateSnapshot,
    player: HomeBaseSnapshot["player"],
  ): HomeBaseSnapshot | undefined {
    return gameState.homeBases.find((homeBase) => homeBase.player === player);
  }

  private static getOpponentPlayer(player: Player): Player {
    return player === Player.SELF ? Player.OPPONENT : Player.SELF;
  }

  private static toPlayerSnapshot(player: Player): HomeBaseSnapshot["player"] {
    return player === Player.SELF ? "self" : "opponent";
  }

  private static isEnemyHomeBase(
    gameState: GameStateSnapshot,
    player: PieceSnapshot["player"],
    target: PanelPosition,
  ): boolean {
    return gameState.homeBases.some(
      (homeBase) =>
        homeBase.player !== player && this.positionEquals(homeBase.panelPosition, target),
    );
  }

  private static positionEquals(
    left: PanelPositionSnapshot | { horizontalLayer: number; verticalLayer: number },
    right: PanelPositionSnapshot | { horizontalLayer: number; verticalLayer: number },
  ): boolean {
    return (
      left.horizontalLayer === right.horizontalLayer && left.verticalLayer === right.verticalLayer
    );
  }

  private static getPieceCombatStats(piece: PieceSnapshot): PieceCombatStats {
    if (piece.pieceType === "knight") {
      return {
        attackPowerAgainstPiece: 5 + (piece.stackCount - 1),
        attackPowerAgainstWall: 2 + (piece.stackCount - 1),
        canAttack: true,
        mergeable: true,
      };
    }

    if (piece.pieceType === "rook") {
      return {
        attackPowerAgainstPiece: 2 + (piece.stackCount - 1),
        attackPowerAgainstWall: 2 + (piece.stackCount - 1),
        canAttack: true,
        mergeable: false,
      };
    }

    return {
      attackPowerAgainstPiece: 0 + (piece.stackCount - 1),
      attackPowerAgainstWall: 0 + (piece.stackCount - 1),
      canAttack: piece.stackCount > 1,
      mergeable: false,
    };
  }
}
