import { MOVEMENT_HOP_COST } from "$lib/domain/constants/GameConstants";
import { PieceType } from "$lib/domain/enums/PieceType";
import type {
  ControllablePlayerSnapshot,
  GameStateSnapshot,
  PanelPositionSnapshot,
  PieceSnapshot,
  PieceTypeSnapshot,
} from "$lib/domain/types/api";
import type { InvariantViolation } from "$lib/domain/types/invariant";

/** Tolerance for fractional HP and movement points produced by proportional damage. */
const FLOAT_TOLERANCE = 1e-9;

const CONTROLLABLE_PLAYERS: ControllablePlayerSnapshot[] = ["self", "opponent"];

const PIECE_TYPES: Record<PieceTypeSnapshot, PieceType> = {
  infantry: PieceType.INFANTRY,
  rook: PieceType.ROOK,
  noble: PieceType.NOBLE,
  archer: PieceType.ARCHER,
  cavalry: PieceType.CAVALRY,
  heavy: PieceType.HEAVY,
  siege: PieceType.SIEGE,
};

/**
 * InvariantService — pure checks for rules that must hold after every game command.
 *
 * Works on transport snapshots only, so it can judge any state (live, restored, or
 * recorded) without touching repositories.
 */
export class InvariantService {
  /** Every invariant violated by <snapshot>. */
  static check(snapshot: GameStateSnapshot): InvariantViolation[] {
    return [
      ...this.checkPieces(snapshot),
      ...this.checkPanels(snapshot),
      ...this.checkResources(snapshot),
    ];
  }

  /**
   * Violations that a command turning <before> into <after> introduced: state violations
   * whose key did not already exist in <before>, plus transition violations.
   */
  static findIntroducedViolations(
    before: GameStateSnapshot,
    after: GameStateSnapshot,
  ): InvariantViolation[] {
    const existingKeys = new Set(this.check(before).map((violation) => violation.key));
    const introduced = this.check(after).filter((violation) => !existingKeys.has(violation.key));

    if (before.turn.winner !== null && JSON.stringify(before) !== JSON.stringify(after)) {
      introduced.push({
        type: "state-changed-after-winner",
        key: "state-changed-after-winner",
        detail: `winner=${before.turn.winner} but the state changed`,
      });
    }

    return introduced;
  }

  private static checkPieces(snapshot: GameStateSnapshot): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const panelKeys = new Set(snapshot.panels.map((panel) => positionKey(panel.panelPosition)));
    const seenIds = new Set<number>();

    for (const piece of snapshot.pieces) {
      const label = pieceLabel(piece);

      if (seenIds.has(piece.id)) {
        violations.push({
          type: "duplicate-piece-id",
          key: `duplicate-piece-id:${piece.id}`,
          detail: `piece id ${piece.id} is used more than once`,
        });
      }
      seenIds.add(piece.id);

      if (!(piece.hp > 0 && piece.hp <= piece.maxHp + FLOAT_TOLERANCE)) {
        violations.push({
          type: "piece-hp-out-of-range",
          key: `piece-hp-out-of-range:${piece.id}`,
          detail: `${label} hp=${piece.hp} maxHp=${piece.maxHp}`,
        });
      }

      const movementRate = PIECE_TYPES[piece.pieceType].config.movement;
      const movementCap = Math.max(movementRate, MOVEMENT_HOP_COST);
      if (piece.movementPoints < 0 || piece.movementPoints > movementCap + FLOAT_TOLERANCE) {
        violations.push({
          type: "movement-points-out-of-range",
          key: `movement-points-out-of-range:${piece.id}`,
          detail: `${label} movementPoints=${piece.movementPoints} cap=${movementCap}`,
        });
      }

      const positions: [string, PanelPositionSnapshot | undefined][] = [
        ["panelPosition", piece.panelPosition],
        ["targetPosition", piece.targetPosition],
        ["rangedAttackTargetPosition", piece.rangedAttackTargetPosition],
      ];
      for (const [field, position] of positions) {
        if (position && !panelKeys.has(positionKey(position))) {
          violations.push({
            type: "piece-off-board",
            key: `piece-off-board:${piece.id}:${field}`,
            detail: `${label} ${field}=(${positionKey(position)}) is not on the board`,
          });
        }
      }
    }

    return violations;
  }

  private static checkPanels(snapshot: GameStateSnapshot): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const piecesByPanel = new Map<string, PieceSnapshot[]>();
    for (const piece of snapshot.pieces) {
      const key = positionKey(piece.panelPosition);
      piecesByPanel.set(key, [...(piecesByPanel.get(key) ?? []), piece]);
    }

    for (const [panel, pieces] of piecesByPanel) {
      const players = CONTROLLABLE_PLAYERS.filter((player) =>
        pieces.some((piece) => piece.player === player),
      );

      if (players.length > 1) {
        violations.push({
          type: "mixed-players-on-panel",
          key: `mixed-players-on-panel:${panel}`,
          detail: `(${panel}) has pieces of both players: ${pieces.map(pieceLabel).join(", ")}`,
        });
      }

      for (const player of players) {
        const ownPieces = pieces.filter((piece) => piece.player === player);
        const mergeablePieces = ownPieces.filter(
          (piece) => PIECE_TYPES[piece.pieceType].config.mergeable,
        );
        const mergeableTypes = new Set(mergeablePieces.map((piece) => piece.pieceType));
        const stackCount = ownPieces.length - mergeablePieces.length + mergeableTypes.size;
        const maxPieces = snapshot.turn.maxPiecesPerPanel[player];

        if (stackCount > maxPieces) {
          violations.push({
            type: "piece-capacity-exceeded",
            key: `piece-capacity-exceeded:${panel}:${player}`,
            detail: `(${panel}) ${player}: ${stackCount} after merging, max ${maxPieces} (${ownPieces.map(pieceLabel).join(", ")})`,
          });
        }

        for (const pieceType of mergeableTypes) {
          const sameType = mergeablePieces.filter((piece) => piece.pieceType === pieceType);
          if (sameType.length > 1) {
            violations.push({
              type: "unmerged-pieces",
              key: `unmerged-pieces:${panel}:${player}:${pieceType}`,
              detail: `(${panel}) ${player}: ${sameType.map(pieceLabel).join(", ")} are not merged`,
            });
          }
        }
      }
    }

    return violations;
  }

  private static checkResources(snapshot: GameStateSnapshot): InvariantViolation[] {
    return CONTROLLABLE_PLAYERS.filter((player) => snapshot.turn.resources[player] < 0).map(
      (player) => ({
        type: "negative-resources",
        key: `negative-resources:${player}`,
        detail: `${player} resources=${snapshot.turn.resources[player]}`,
      }),
    );
  }
}

function positionKey(position: PanelPositionSnapshot): string {
  return `${position.horizontalLayer},${position.verticalLayer}`;
}

function pieceLabel(piece: PieceSnapshot): string {
  return `${piece.pieceType}#${piece.id}`;
}
