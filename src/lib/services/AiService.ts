import { Player } from "$lib/domain/enums/Player";
import { PieceType } from "$lib/domain/enums/PieceType";
import { GameApi } from "$lib/api/GameApi";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type {
  GameStateSnapshot,
  PanelPositionSnapshot,
  PanelSnapshot,
  PieceSnapshot,
} from "$lib/domain/types/api";
import { AiStrength } from "$lib/domain/enums/AiStrength";

interface PieceCombatStats {
  attackPowerAgainstPiece: number;
  attackPowerAgainstWall: number;
  canAttack: boolean;
  mergeable: boolean;
}

interface ScoredTarget {
  score: number;
  target: PanelPosition;
}

export class AiService {
  /**
   * Execute an AI-controlled turn for the given player.
   *
   * 1. Assign random moves for all pieces owned by the player.
   * 2. Attempt to generate a piece if affordable.
   * 3. End the turn via GameApi.
   */
  static doAiTurn(player: Player, strength: AiStrength = AiStrength.STRENGTH_1) {
    const gameState = GameApi.getGameState();
    if (gameState.turn.player !== String(player) || gameState.turn.winner) return;

    this.assignMoves(player, strength);
    this.generatePiece(player, strength);
    GameApi.endTurn(player);
  }

  private static assignMoves(player: Player, strength: AiStrength): void {
    const pieces = GameApi.getGameState().pieces.filter((piece) => piece.player === String(player));

    for (const piece of pieces) {
      const latestGameState = GameApi.getGameState();
      const latestPiece = latestGameState.pieces.find((candidate) => candidate.id === piece.id);
      if (!latestPiece) continue;

      const targets = GameApi.getMovableTargets(piece.id);
      if (targets.length === 0) continue;

      const selectedTarget =
        strength === AiStrength.STRENGTH_2
          ? this.selectStrategicTarget(latestGameState, latestPiece, targets)
          : this.selectRandomTarget(targets);

      GameApi.assignMove(player, piece.id, selectedTarget);
    }
  }

  private static generatePiece(player: Player, strength: AiStrength): void {
    if (strength === AiStrength.STRENGTH_2) {
      while (true) {
        const gameState = GameApi.getGameState();
        const currentResources = gameState.turn.resources[String(player)] ?? 0;
        const preferredPieceType = this.selectStrategicPieceType(
          gameState,
          player,
          currentResources,
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

    const gameState = GameApi.getGameState();
    const currentResources = gameState.turn.resources[String(player)] ?? 0;

    const pieceTypes = [PieceType.KNIGHT, PieceType.BISHOP, PieceType.ROOK];
    const affordablePieceTypes = pieceTypes.filter(
      (pieceType) =>
        pieceType.config.cost <= currentResources && GameApi.canGenerate(player, pieceType),
    );
    if (affordablePieceTypes.length === 0) return;

    const randomPieceType =
      affordablePieceTypes[Math.floor(Math.random() * affordablePieceTypes.length)];
    GameApi.generatePiece(player, randomPieceType);
  }

  private static selectStrategicPieceType(
    gameState: GameStateSnapshot,
    player: Player,
    currentResources: number,
  ): PieceType | null {
    const preferredOrder = [PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP];
    const availablePieceTypes = preferredOrder.filter(
      (pieceType) =>
        pieceType.config.cost <= currentResources && GameApi.canGenerate(player, pieceType),
    );
    if (availablePieceTypes.length === 0) {
      return null;
    }

    const ownPieces = gameState.pieces.filter((piece) => piece.player === String(player));
    const pieceTypeCounts = ownPieces.reduce(
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

  private static selectRandomTarget(targets: PanelPosition[]): PanelPosition {
    return targets[Math.floor(Math.random() * targets.length)];
  }

  private static selectStrategicTarget(
    gameState: GameStateSnapshot,
    piece: PieceSnapshot,
    targets: PanelPosition[],
  ): PanelPosition {
    const scoredTargets: ScoredTarget[] = targets.map((target) => ({
      target,
      score: this.scoreTarget(gameState, piece, target),
    }));

    scoredTargets.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.target.horizontalLayer !== right.target.horizontalLayer) {
        return left.target.horizontalLayer - right.target.horizontalLayer;
      }

      return left.target.verticalLayer - right.target.verticalLayer;
    });

    return scoredTargets[0]?.target ?? targets[0];
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
    target: PanelPosition,
  ): PanelSnapshot | undefined {
    return gameState.panels.find((panel) => this.positionEquals(panel.panelPosition, target));
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
