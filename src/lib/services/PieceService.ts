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
  static find(panelPosition: PanelPosition): Piece | undefined {
    const pieces = PiecesRepository.getAll();
    return pieces.find((x: Piece) => x.panelPosition.equals(panelPosition));
  }

  static findByPlayer(player: Player): Piece | undefined {
    const pieces = PiecesRepository.getAll();
    return pieces.find((x: Piece) => x.player === player);
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

    // Castle-first rule: wall must be destroyed before engaging units
    if (isEnemyPanel && targetPanel.castle > 0) {
      const castleBefore = targetPanel.castle;
      CombatService.attackWallMulti(attackers, targetPanel);
      const castleAfter = PanelRepository.find(targetPosition)?.castle ?? 0;
      for (const a of attackers) {
        PiecesRepository.update(new Piece({ ...a, targetPosition: undefined }));
      }
      return {
        targetPosition: {
          horizontalLayer: targetPosition.horizontalLayer,
          verticalLayer: targetPosition.verticalLayer,
        },
        destroyedPieceIds: [],
        entered: false,
        wallDamageDealt: castleBefore - castleAfter,
      };
    }

    // Identify enemy defenders at the target panel
    const defenders = PiecesRepository.getPiecesByPosition(targetPosition).filter(
      (p) => p.player !== attackerPlayer,
    );

    const hasCombat = defenders.length > 0;

    let deadIds = new Set<number>();
    if (hasCombat) {
      const result = CombatService.resolveCombat(attackers, defenders);
      deadIds = result.deadIds;
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

    if (!hasCombat) return null;

    return {
      targetPosition: {
        horizontalLayer: targetPosition.horizontalLayer,
        verticalLayer: targetPosition.verticalLayer,
      },
      destroyedPieceIds: [...deadIds],
      entered: canEnter,
      wallDamageDealt: 0,
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
