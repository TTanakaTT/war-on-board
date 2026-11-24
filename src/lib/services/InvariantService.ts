import { MOVEMENT_HOP_COST } from "#lib/domain/config.ts";
import {
  maxPiecesAt,
  pieceConfig,
  posKey,
  SIDES,
  terrainConfig,
  type GameState,
  type Piece,
} from "#lib/domain/model.ts";
import type { InvariantViolation, InvariantViolationType } from "#lib/domain/types.ts";

/** Tolerance for fractional HP and movement points. */
const EPSILON = 1e-9;

const label = (piece: Piece) => `${piece.pieceType}#${piece.id}`;
const violation = (
  type: InvariantViolationType,
  subject: string,
  detail: string,
): InvariantViolation => ({ type, key: `${type}:${subject}`, detail });

/** Rules that must hold after every command, judged on snapshots only. */
export class InvariantService {
  static check(state: GameState): InvariantViolation[] {
    return [...this.checkPieces(state), ...this.checkPanels(state), ...this.checkResources(state)];
  }

  /** Violations whose key was not in <before>, plus state changes after the game ended. */
  static findIntroducedViolations(before: GameState, after: GameState): InvariantViolation[] {
    const existing = new Set(this.check(before).map((v) => v.key));
    const introduced = this.check(after).filter((v) => !existing.has(v.key));
    if (before.turn.winner !== null && JSON.stringify(before) !== JSON.stringify(after)) {
      introduced.push({
        type: "state-changed-after-winner",
        key: "state-changed-after-winner",
        detail: `winner=${before.turn.winner} but the state changed`,
      });
    }
    return introduced;
  }

  private static checkPieces(state: GameState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const panelKeys = new Set(
      state.panels
        .filter((panel) => terrainConfig(panel.terrain).passable)
        .map((panel) => posKey(panel.panelPosition)),
    );
    const seenIds = new Set<number>();

    for (const piece of state.pieces) {
      if (seenIds.has(piece.id)) {
        violations.push(
          violation(
            "duplicate-piece-id",
            `${piece.id}`,
            `piece id ${piece.id} is used more than once`,
          ),
        );
      }
      seenIds.add(piece.id);

      if (!(piece.hp > 0 && piece.hp <= piece.maxHp + EPSILON)) {
        violations.push(
          violation(
            "piece-hp-out-of-range",
            `${piece.id}`,
            `${label(piece)} hp=${piece.hp} maxHp=${piece.maxHp}`,
          ),
        );
      }

      const cap = Math.max(pieceConfig(piece.pieceType).movement, MOVEMENT_HOP_COST);
      if (piece.movementPoints < 0 || piece.movementPoints > cap + EPSILON) {
        violations.push(
          violation(
            "movement-points-out-of-range",
            `${piece.id}`,
            `${label(piece)} movementPoints=${piece.movementPoints} cap=${cap}`,
          ),
        );
      }

      const fields = [
        "panelPosition",
        "targetPosition",
        "rangedAttackTargetPosition",
        "transitPosition",
      ] as const;
      for (const field of fields) {
        const position = piece[field];
        if (position && !panelKeys.has(posKey(position))) {
          violations.push(
            violation(
              "piece-off-board",
              `${piece.id}:${field}`,
              `${label(piece)} ${field}=(${posKey(position)}) is not on a passable panel`,
            ),
          );
        }
      }
    }
    return violations;
  }

  private static checkPanels(state: GameState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const byPanel = new Map<string, Piece[]>();
    for (const piece of state.pieces) {
      const key = posKey(piece.panelPosition);
      byPanel.set(key, [...(byPanel.get(key) ?? []), piece]);
    }

    for (const [panel, pieces] of byPanel) {
      const players = SIDES.filter((side) => pieces.some((p) => p.player === side));
      if (players.length > 1) {
        violations.push(
          violation(
            "mixed-players-on-panel",
            panel,
            `(${panel}) has pieces of both players: ${pieces.map(label).join(", ")}`,
          ),
        );
      }

      for (const player of players) {
        const own = pieces.filter((p) => p.player === player);
        const mergeable = own.filter((p) => pieceConfig(p.pieceType).mergeable);
        const types = new Set(mergeable.map((p) => p.pieceType));
        const stackCount = own.length - mergeable.length + types.size;
        const maxPieces = maxPiecesAt(
          pieces[0].panelPosition,
          state.turn.maxPiecesPerPanel[player],
          state.homeBases,
        );
        if (stackCount > maxPieces) {
          violations.push(
            violation(
              "piece-capacity-exceeded",
              `${panel}:${player}`,
              `(${panel}) ${player}: ${stackCount} after merging, max ${maxPieces} (${own.map(label).join(", ")})`,
            ),
          );
        }
        for (const type of types) {
          // A piece in transit merges only once it arrives.
          const sameType = mergeable.filter((p) => p.pieceType === type && !p.transitPosition);
          if (sameType.length > 1) {
            violations.push(
              violation(
                "unmerged-pieces",
                `${panel}:${player}:${type}`,
                `(${panel}) ${player}: ${sameType.map(label).join(", ")} are not merged`,
              ),
            );
          }
        }
      }
    }
    return violations;
  }

  private static checkResources(state: GameState): InvariantViolation[] {
    return SIDES.filter((side) => state.turn.resources[side] < 0).map((side) =>
      violation("negative-resources", side, `${side} resources=${state.turn.resources[side]}`),
    );
  }
}
