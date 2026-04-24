import { Piece } from "$lib/domain/entities/Piece";
import { PiecesRepository } from "$lib/data/repositories/PieceRepository";
import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
import type { CombatOutcome } from "$lib/domain/types/api";
import { Player } from "$lib/domain/enums/Player";
import { Panel } from "$lib/domain/entities/Panel";
import { PanelRepository } from "$lib/data/repositories/PanelRepository";
import { PanelState } from "$lib/domain/enums/PanelState";
import { PieceType } from "$lib/domain/enums/PieceType";
import { CombatService } from "$lib/services/CombatService";
import { PASSIVE_RESOURCE_CAP, PASSIVE_CASTLE_CAP } from "$lib/domain/constants/GameConstants";

export class PieceService {
  /**
   * Merge all mergeable pieces of the same type and player at the given panel position.
   *
   * For each group (player × pieceType) where pieceType.config.mergeable === true
   * and the group has more than one piece:
   *   - The piece with the lowest ID becomes the merged unit.
   *   - HP, maxHp, and stackCount are summed across all pieces in the group.
   *   - All other pieces in the group are removed from the repository.
   */
  static mergePiecesAtPosition(position: PanelPosition): void {
    const piecesAtPanel = PiecesRepository.getPiecesByPosition(position);

    // Group by player + pieceType
    const groups = new Map<string, Piece[]>();
    for (const piece of piecesAtPanel) {
      if (!piece.pieceType.config.mergeable) continue;
      const key = `${String(piece.player)}:${piece.pieceType.config.iconName}`;
      const group = groups.get(key);
      if (group) {
        group.push(piece);
      } else {
        groups.set(key, [piece]);
      }
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;

      // Sort by ID — lowest ID is the base piece
      group.sort((a, b) => a.id - b.id);
      const [base, ...rest] = group;

      const totalHp = group.reduce((sum, p) => sum + p.hp, 0);
      const totalMaxHp = group.reduce((sum, p) => sum + p.maxHp, 0);
      const totalStackCount = group.reduce((sum, p) => sum + p.stackCount, 0);

      PiecesRepository.update(
        new Piece({
          ...base,
          hp: totalHp,
          maxHp: totalMaxHp,
          stackCount: totalStackCount,
        }),
      );

      for (const other of rest) {
        PiecesRepository.remove(other);
      }
    }
  }

  /**
   * Merge mergeable pieces at every panel position occupied by the given player.
   */
  static mergeAllPiecesForPlayer(player: Player): void {
    const playerPieces = PiecesRepository.getPiecesByPlayer(player);
    const uniquePositions = new Map<string, PanelPosition>();
    for (const piece of playerPieces) {
      const key = `${piece.panelPosition.horizontalLayer},${piece.panelPosition.verticalLayer}`;
      uniquePositions.set(key, piece.panelPosition);
    }
    for (const position of uniquePositions.values()) {
      this.mergePiecesAtPosition(position);
    }
  }

  static generateNextId(): number {
    return (
      PiecesRepository.getAll().reduce((max: number, piece: Piece) => Math.max(max, piece.id), 0) +
      1
    );
  }

  static move(panelPosition: PanelPosition, selectedPiece: Piece) {
    const newPiece = new Piece({
      id: selectedPiece.id,
      panelPosition: panelPosition,
      initialPosition: panelPosition,
      targetPosition: undefined,
      player: selectedPiece.player,
      pieceType: selectedPiece.pieceType,
      hp: selectedPiece.hp,
      stackCount: selectedPiece.stackCount,
      maxHp: selectedPiece.maxHp,
    });
    PiecesRepository.update(newPiece);
  }

  static resetInitialPositions(player: Player) {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    for (const piece of pieces) {
      const newPiece = new Piece({
        ...piece,
        initialPosition: piece.panelPosition,
      });
      PiecesRepository.update(newPiece);
    }
  }

  /**
   * Resolve combat/movement for a group of attackers targeting the same panel.
   *
   * Flow:
   *   1. Castle-first: if enemy castle > 0, all attackers hit the wall → stay
   *   2. Multi-unit combat: front-line selection, simultaneous damage
   *   3. If target cleared (no enemies, no wall): surviving attackers move in
   *
   * @returns CombatOutcome if combat occurred, null if no enemies/wall at target.
   */
  private static resolveTargetPanel(
    attackers: Piece[],
    targetPosition: PanelPosition,
  ): CombatOutcome | null {
    const targetPanel = PanelRepository.find(targetPosition);
    const attackerPlayer = attackers[0].player;

    const isEnemyPanel =
      targetPanel && targetPanel.player !== attackerPlayer && targetPanel.player !== Player.UNKNOWN;

    const defenders = PiecesRepository.getPiecesByPosition(targetPosition).filter(
      (p) => p.player !== attackerPlayer,
    );

    const hadWallCombat = Boolean(isEnemyPanel && targetPanel.castle > 0);
    let wallDamageDealt = 0;
    let deadIds = new Set<number>();

    if (targetPanel && hadWallCombat) {
      const wallAttackResult = CombatService.attackWallMulti(attackers, targetPanel);
      wallDamageDealt = wallAttackResult.wallDamageDealt;

      if (wallAttackResult.overflowPieceDamage > 0 && defenders.length > 0) {
        const overflowResult = CombatService.distributeDamage(
          defenders,
          wallAttackResult.overflowPieceDamage,
        );
        deadIds = new Set([...deadIds, ...overflowResult.deadIds]);
      }
    }

    const hasCombat = defenders.length > 0;

    if (!hadWallCombat && hasCombat) {
      const result = CombatService.resolveCombat(attackers, defenders);
      deadIds = new Set([...deadIds, ...result.deadIds]);
    }

    // Re-read panel (may have been modified)
    const currentPanel = PanelRepository.find(targetPosition);

    // Check if the target is clear for entry
    const remainingEnemies = PiecesRepository.getPiecesByPosition(targetPosition).filter(
      (p) => p.player !== attackerPlayer,
    );
    const noWall =
      !currentPanel ||
      currentPanel.player === attackerPlayer ||
      currentPanel.player === Player.UNKNOWN ||
      currentPanel.castle <= 0;
    const canEnter = remainingEnemies.length === 0 && noWall;

    for (const atk of attackers) {
      if (deadIds.has(atk.id)) continue;
      const current = PiecesRepository.getAll().find((p) => p.id === atk.id);
      if (!current) continue;

      if (canEnter) {
        this.move(targetPosition, current);
      } else {
        PiecesRepository.update(new Piece({ ...current, targetPosition: undefined }));
      }
    }

    if (canEnter && currentPanel) {
      PanelRepository.update(
        new Panel({
          panelPosition: targetPosition,
          panelState: PanelState.OCCUPIED,
          player: attackerPlayer,
          resource: currentPanel.resource ?? 0,
          castle: currentPanel.castle ?? 0,
        }),
      );
    }

    if (!hadWallCombat && !hasCombat) return null;

    return {
      targetPosition: {
        horizontalLayer: targetPosition.horizontalLayer,
        verticalLayer: targetPosition.verticalLayer,
      },
      destroyedPieceIds: [...deadIds],
      entered: canEnter,
      wallDamageDealt,
    };
  }

  static applyPassiveGains(player: Player) {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    pieces.forEach((piece: Piece) => {
      const panel = PanelRepository.find(piece.panelPosition);
      if (!panel) return;

      if (piece.pieceType === PieceType.BISHOP) {
        PanelRepository.update(
          new Panel({
            ...panel,
            resource: Math.min(PASSIVE_RESOURCE_CAP, (panel.resource || 0) + 1),
          }),
        );
      } else if (piece.pieceType === PieceType.ROOK) {
        // Increase castle by 1, cap growth at PASSIVE_CASTLE_CAP but never reduce existing values above it (e.g. home base=10)
        const increased = Math.min(PASSIVE_CASTLE_CAP, (panel.castle || 0) + 1);
        PanelRepository.update(
          new Panel({
            ...panel,
            castle: Math.max(panel.castle, increased),
          }),
        );
      } else {
        PanelRepository.update(
          new Panel({
            ...panel,
            player: player,
          }),
        );
      }
    });
  }

  /**
   * Finalize all pending moves for a player.
   *
   * Groups attackers by target panel, then resolves each group
   * with simultaneous multi-unit combat.
   *
   * @returns Combat outcomes for groups where combat occurred.
   */
  static finalizePlayerMoves(player: Player): CombatOutcome[] {
    const pieces = PiecesRepository.getPiecesByPlayer(player);
    const piecesWithMoves = pieces.filter((p) => p.targetPosition);

    // Group by target panel position
    const groups = new Map<string, { attackers: Piece[]; target: PanelPosition }>();
    for (const piece of piecesWithMoves) {
      const tp = piece.targetPosition!;
      const key = `${tp.horizontalLayer},${tp.verticalLayer}`;
      const group = groups.get(key);
      if (group) {
        group.attackers.push(piece);
      } else {
        groups.set(key, { attackers: [piece], target: tp });
      }
    }

    const outcomes: CombatOutcome[] = [];
    for (const { attackers, target } of groups.values()) {
      const outcome = this.resolveTargetPanel(attackers, target);
      if (outcome) outcomes.push(outcome);
    }
    return outcomes;
  }
}
