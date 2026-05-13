import { expect, test, describe } from "vitest";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { Piece } from "$lib/domain/entities/Piece";
import { PieceType } from "$lib/domain/enums/PieceType";
import { Player } from "$lib/domain/enums/Player";
import {
  compareScoredTargets,
  getPieceCombatStats,
  selectStrategicTarget,
} from "$lib/services/ai/targetScoring";
import type { AiStrengthProfile } from "$lib/services/ai/types";
import type { GameStateSnapshot, PieceSnapshot } from "$lib/domain/types/api";

const standardProfile: AiStrengthProfile = {
  moveSelection: "strategic",
  generationModeSelection: "frontline",
  lookaheadCandidateCount: 0,
  lookaheadWeight: 0,
  preferredPieceOrder: [PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP],
  targetScoring: "standard",
  pieceSelection: "standard",
};

const homeSideGrowthProfile: AiStrengthProfile = {
  ...standardProfile,
  targetScoring: "home-side-growth",
};

function snapshotPosition(horizontalLayer: number, verticalLayer: number) {
  return { horizontalLayer, verticalLayer };
}

function createPieceSnapshot(
  pieceType: PieceType,
  position: { horizontalLayer: number; verticalLayer: number },
  overrides: Partial<PieceSnapshot> = {},
): PieceSnapshot {
  return {
    id: overrides.id ?? 1,
    panelPosition:
      overrides.panelPosition ?? snapshotPosition(position.horizontalLayer, position.verticalLayer),
    initialPosition:
      overrides.initialPosition ??
      snapshotPosition(position.horizontalLayer, position.verticalLayer),
    targetPosition: overrides.targetPosition,
    player: overrides.player ?? "self",
    pieceType: overrides.pieceType ?? (String(pieceType) as PieceSnapshot["pieceType"]),
    hp: overrides.hp ?? pieceType.config.maxHp,
    stackCount: overrides.stackCount ?? 1,
    maxHp: overrides.maxHp ?? pieceType.config.maxHp,
  };
}

function createGameStateSnapshot(options: {
  panels: GameStateSnapshot["panels"];
  pieces: GameStateSnapshot["pieces"];
  layer?: number;
}): GameStateSnapshot {
  return {
    panels: options.panels,
    pieces: options.pieces,
    turn: {
      num: 1,
      player: "self",
      resources: { self: 5, opponent: 5 },
      maxPiecesPerPanel: { self: 2, opponent: 2 },
      generationMode: { self: "rear", opponent: "rear" },
      winner: null,
    },
    homeBases: [
      { player: "self", panelPosition: snapshotPosition(-2, 0) },
      { player: "opponent", panelPosition: snapshotPosition(2, 0) },
    ],
    layer: options.layer ?? 3,
  };
}

describe("getPieceCombatStats", () => {
  test.each([
    { pieceTypeSnapshot: "knight", pieceType: PieceType.KNIGHT, stackCount: 1 },
    { pieceTypeSnapshot: "rook", pieceType: PieceType.ROOK, stackCount: 2 },
    { pieceTypeSnapshot: "bishop", pieceType: PieceType.BISHOP, stackCount: 1 },
    { pieceTypeSnapshot: "bishop", pieceType: PieceType.BISHOP, stackCount: 3 },
  ] as const)(
    "derives %s stats from PieceType config for stackCount=%i",
    ({ pieceTypeSnapshot, pieceType, stackCount }) => {
      const panelPosition = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
      const domainPiece = new Piece({
        id: 1,
        panelPosition,
        initialPosition: panelPosition,
        player: Player.SELF,
        pieceType,
        stackCount,
      });
      const pieceSnapshot: PieceSnapshot = {
        id: domainPiece.id,
        panelPosition: {
          horizontalLayer: panelPosition.horizontalLayer,
          verticalLayer: panelPosition.verticalLayer,
        },
        initialPosition: {
          horizontalLayer: panelPosition.horizontalLayer,
          verticalLayer: panelPosition.verticalLayer,
        },
        player: "self",
        pieceType: pieceTypeSnapshot,
        hp: domainPiece.hp,
        stackCount: domainPiece.stackCount,
        maxHp: domainPiece.maxHp,
      };

      expect(getPieceCombatStats(pieceSnapshot)).toEqual({
        attackPowerAgainstPiece: domainPiece.attackPowerAgainstPiece,
        attackPowerAgainstWall: domainPiece.attackPowerAgainstWall,
        canAttack: domainPiece.canAttack,
        mergeable: pieceType.config.mergeable,
      });
    },
  );
});

describe("selectStrategicTarget", () => {
  test("prioritizes capturing an undefended enemy home base", () => {
    const piece = createPieceSnapshot(PieceType.KNIGHT, snapshotPosition(1, 0));
    const fallbackTarget = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
    const winningTarget = new PanelPosition({ horizontalLayer: 2, verticalLayer: 0 });
    const gameState = createGameStateSnapshot({
      panels: [
        {
          panelPosition: snapshotPosition(0, 0),
          panelState: "unoccupied",
          player: "unknown",
          resource: 0,
          castle: 0,
        },
        {
          panelPosition: snapshotPosition(1, 0),
          panelState: "occupied",
          player: "self",
          resource: 0,
          castle: 0,
        },
        {
          panelPosition: snapshotPosition(2, 0),
          panelState: "unoccupied",
          player: "opponent",
          resource: 5,
          castle: 0,
        },
      ],
      pieces: [piece],
    });

    const selectedTarget = selectStrategicTarget(
      gameState,
      piece,
      [fallbackTarget, winningTarget],
      standardProfile,
    );

    expect(selectedTarget.equals(winningTarget)).toBe(true);
  });

  test("keeps a rook on a growable home-side panel for home-side-growth scoring", () => {
    const stayTarget = new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 });
    const advanceTarget = new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 });
    const piece = createPieceSnapshot(PieceType.ROOK, snapshotPosition(0, 0));
    const gameState = createGameStateSnapshot({
      panels: [
        {
          panelPosition: snapshotPosition(0, 0),
          panelState: "occupied",
          player: "self",
          resource: 0,
          castle: 0,
        },
        {
          panelPosition: snapshotPosition(1, 0),
          panelState: "unoccupied",
          player: "self",
          resource: 0,
          castle: 0,
        },
      ],
      pieces: [piece],
    });

    const selectedTarget = selectStrategicTarget(
      gameState,
      piece,
      [advanceTarget, stayTarget],
      homeSideGrowthProfile,
    );

    expect(selectedTarget.equals(stayTarget)).toBe(true);
  });
});

describe("compareScoredTargets", () => {
  test("breaks ties toward the opponent side for self", () => {
    const leftTarget = {
      score: 10,
      target: new PanelPosition({ horizontalLayer: 0, verticalLayer: 0 }),
      laneLoad: 0,
      laneShift: 0,
    };
    const rightTarget = {
      score: 10,
      target: new PanelPosition({ horizontalLayer: 1, verticalLayer: 0 }),
      laneLoad: 0,
      laneShift: 0,
    };

    expect(compareScoredTargets(leftTarget, rightTarget, Player.SELF)).toBeGreaterThan(0);
  });
});
