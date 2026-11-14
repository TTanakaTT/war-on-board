import { describe, expect, test } from "vitest";
import { GameApi } from "$lib/api/GameApi";
import type {
  GameStateSnapshot,
  PanelPositionSnapshot,
  PieceSnapshot,
} from "$lib/domain/types/api";
import type { InvariantViolation } from "$lib/domain/types/invariant";
import { InvariantService } from "$lib/services/InvariantService";

const CENTER: PanelPositionSnapshot = { horizontalLayer: 0, verticalLayer: 0 };
const NEXT_TO_CENTER: PanelPositionSnapshot = { horizontalLayer: 0, verticalLayer: 1 };

function initialSnapshot(): GameStateSnapshot {
  GameApi.initializeGame({ layer: 4 });
  return GameApi.getGameState();
}

function createPiece(overrides: Partial<PieceSnapshot> & Pick<PieceSnapshot, "id">): PieceSnapshot {
  const panelPosition = overrides.panelPosition ?? CENTER;

  return {
    panelPosition,
    initialPosition: panelPosition,
    player: "self",
    pieceType: "infantry",
    hp: 10,
    stackCount: 1,
    maxHp: 10,
    movementPoints: 0,
    ...overrides,
  };
}

function withPieces(snapshot: GameStateSnapshot, pieces: PieceSnapshot[]): GameStateSnapshot {
  return { ...snapshot, pieces: [...snapshot.pieces, ...pieces] };
}

function summarize(violations: InvariantViolation[]): { type: string; key: string }[] {
  return violations.map(({ type, key }) => ({ type, key }));
}

describe("InvariantService.check", () => {
  test("returns no violations right after initializeGame", () => {
    expect(InvariantService.check(initialSnapshot())).toEqual([]);
  });

  test("piece-capacity-exceeded: reports a panel holding more stacks than allowed", () => {
    const snapshot = withPieces(initialSnapshot(), [
      createPiece({ id: 1, pieceType: "infantry" }),
      createPiece({ id: 2, pieceType: "archer" }),
      createPiece({ id: 3, pieceType: "rook" }),
    ]);

    expect(summarize(InvariantService.check(snapshot))).toEqual([
      { type: "piece-capacity-exceeded", key: "piece-capacity-exceeded:0,0:self" },
    ]);
  });

  test("piece-capacity-exceeded: counts mergeable pieces of the same type as one stack", () => {
    const snapshot = withPieces(initialSnapshot(), [
      createPiece({ id: 1, pieceType: "infantry" }),
      createPiece({ id: 2, pieceType: "infantry" }),
      createPiece({ id: 3, pieceType: "archer" }),
    ]);

    const types = InvariantService.check(snapshot).map((violation) => violation.type);

    expect(types).not.toContain("piece-capacity-exceeded");
  });

  test("mixed-players-on-panel: reports a panel holding both players' pieces", () => {
    const snapshot = withPieces(initialSnapshot(), [
      createPiece({ id: 1, player: "self" }),
      createPiece({ id: 2, player: "opponent" }),
    ]);

    expect(summarize(InvariantService.check(snapshot))).toEqual([
      { type: "mixed-players-on-panel", key: "mixed-players-on-panel:0,0" },
    ]);
  });

  test("piece-hp-out-of-range: reports a piece with no HP left", () => {
    const snapshot = withPieces(initialSnapshot(), [createPiece({ id: 1, hp: 0 })]);

    expect(summarize(InvariantService.check(snapshot))).toEqual([
      { type: "piece-hp-out-of-range", key: "piece-hp-out-of-range:1" },
    ]);
  });

  test("movement-points-out-of-range: reports negative movement points", () => {
    const snapshot = withPieces(initialSnapshot(), [createPiece({ id: 1, movementPoints: -1 })]);

    expect(summarize(InvariantService.check(snapshot))).toEqual([
      { type: "movement-points-out-of-range", key: "movement-points-out-of-range:1" },
    ]);
  });

  test("duplicate-piece-id: reports an id used by more than one piece", () => {
    const snapshot = withPieces(initialSnapshot(), [
      createPiece({ id: 1, panelPosition: CENTER }),
      createPiece({ id: 1, panelPosition: NEXT_TO_CENTER }),
    ]);

    expect(summarize(InvariantService.check(snapshot))).toEqual([
      { type: "duplicate-piece-id", key: "duplicate-piece-id:1" },
    ]);
  });

  test("piece-off-board: reports a piece field pointing outside the board", () => {
    const snapshot = withPieces(initialSnapshot(), [
      createPiece({
        id: 1,
        rangedAttackTargetPosition: { horizontalLayer: 99, verticalLayer: 99 },
      }),
    ]);

    expect(summarize(InvariantService.check(snapshot))).toEqual([
      { type: "piece-off-board", key: "piece-off-board:1:rangedAttackTargetPosition" },
    ]);
  });

  test("unmerged-pieces: reports mergeable pieces of the same type left unmerged", () => {
    const snapshot = withPieces(initialSnapshot(), [
      createPiece({ id: 1, pieceType: "infantry" }),
      createPiece({ id: 2, pieceType: "infantry" }),
    ]);

    expect(summarize(InvariantService.check(snapshot))).toEqual([
      { type: "unmerged-pieces", key: "unmerged-pieces:0,0:self:infantry" },
    ]);
  });

  test("negative-resources: reports a player with negative resources", () => {
    const snapshot = initialSnapshot();
    const negative: GameStateSnapshot = {
      ...snapshot,
      turn: { ...snapshot.turn, resources: { ...snapshot.turn.resources, opponent: -1 } },
    };

    expect(summarize(InvariantService.check(negative))).toEqual([
      { type: "negative-resources", key: "negative-resources:opponent" },
    ]);
  });
});

describe("InvariantService.findIntroducedViolations", () => {
  test("returns only violations whose key did not exist before", () => {
    const before = withPieces(initialSnapshot(), [createPiece({ id: 1, hp: 0 })]);
    const after = withPieces(before, [
      createPiece({ id: 2, movementPoints: -1, panelPosition: NEXT_TO_CENTER }),
    ]);

    expect(InvariantService.check(after).map((violation) => violation.key)).toContain(
      "piece-hp-out-of-range:1",
    );
    expect(summarize(InvariantService.findIntroducedViolations(before, after))).toEqual([
      { type: "movement-points-out-of-range", key: "movement-points-out-of-range:2" },
    ]);
  });

  test("returns state-changed-after-winner when the state changes after a winner is decided", () => {
    const snapshot = initialSnapshot();
    const finished: GameStateSnapshot = { ...snapshot, turn: { ...snapshot.turn, winner: "self" } };
    const changed: GameStateSnapshot = {
      ...finished,
      turn: { ...finished.turn, resources: { ...finished.turn.resources, self: 999 } },
    };

    expect(summarize(InvariantService.findIntroducedViolations(finished, changed))).toEqual([
      { type: "state-changed-after-winner", key: "state-changed-after-winner" },
    ]);
  });

  test("does not return state-changed-after-winner when the finished state stays the same", () => {
    const snapshot = initialSnapshot();
    const finished: GameStateSnapshot = { ...snapshot, turn: { ...snapshot.turn, winner: "self" } };

    expect(InvariantService.findIntroducedViolations(finished, structuredClone(finished))).toEqual(
      [],
    );
  });
});
