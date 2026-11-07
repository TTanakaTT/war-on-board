import { expect, test, describe } from "vitest";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { PieceType } from "$lib/domain/enums/PieceType";
import { scoreTarget } from "$lib/services/ai/targetScore";
import type { AiStrengthProfile } from "$lib/services/ai/types";
import type { GameStateSnapshot, PieceSnapshot } from "$lib/domain/types/api";

function snapshotPosition(horizontalLayer: number, verticalLayer: number) {
  return { horizontalLayer, verticalLayer };
}

function createProfile(
  combatAssertiveness: AiStrengthProfile["combatAssertiveness"],
): AiStrengthProfile {
  return {
    moveSelection: "strategic",
    generationModeSelection: "frontline",
    lookaheadCandidateCount: 0,
    lookaheadWeight: 0,
    preferredPieceOrder: [PieceType.ROOK, PieceType.INFANTRY, PieceType.NOBLE],
    targetScoring: "standard",
    pieceSelection: "standard",
    combatAssertiveness,
  };
}

function createGameStateSnapshot(options: {
  panels: GameStateSnapshot["panels"];
  pieces: GameStateSnapshot["pieces"];
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
    layer: 3,
  };
}

describe("scoreTarget against a walled enemy panel", () => {
  test("aggressive combatAssertiveness scores a chip attack far above standard", () => {
    const piece: PieceSnapshot = {
      id: 1,
      panelPosition: snapshotPosition(0, 0),
      initialPosition: snapshotPosition(0, 0),
      targetPosition: undefined,
      player: "self",
      pieceType: "infantry",
      hp: PieceType.INFANTRY.config.maxHp,
      stackCount: 1,
      maxHp: PieceType.INFANTRY.config.maxHp,
      movementPoints: PieceType.INFANTRY.config.movement,
    };
    const target = new PanelPosition(snapshotPosition(1, 0));
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
          player: "opponent",
          resource: 0,
          castle: 10,
        },
      ],
      pieces: [piece],
    });

    const standardScore = scoreTarget(gameState, piece, target, createProfile("standard"), [
      target,
    ]);
    const aggressiveScore = scoreTarget(gameState, piece, target, createProfile("aggressive"), [
      target,
    ]);

    // A single Infantry (attackPowerAgainstWall=1) can't dent a castle=10 wall this
    // turn either way, but "standard" must not make chipping away at it attractive,
    // while "aggressive" must score it above idling (0) so weak AI levels stop
    // skipping home base assaults entirely — see REMAINING_CASTLE_PENALTY.
    expect(standardScore).toBeLessThan(0);
    expect(aggressiveScore).toBeGreaterThan(0);
    expect(aggressiveScore).toBeGreaterThan(standardScore);
  });

  test("a large merged stack scores an assault favorably against weak defenders", () => {
    // Regression test for a bug found via live AI-vs-AI playtesting: a 278-strong
    // merged Infantry stack sat adjacent to an enemy home base guarded only by a
    // Heavy and a Noble (total defense well below the stack's raw per-unit attack
    // power) for 100+ turns without ever attacking. The AI's damage estimate used
    // attackPowerAgainstPiece unscaled by stackCount, so it judged a single unit's
    // worth of damage (5) against the defenders' combined HP and always saw a loss
    // — even though CombatService actually scales piece-vs-piece damage by
    // stackCount, so the real stack would crush both defenders instantly.
    const piece: PieceSnapshot = {
      id: 1,
      panelPosition: snapshotPosition(0, 0),
      initialPosition: snapshotPosition(0, 0),
      targetPosition: undefined,
      player: "self",
      pieceType: "infantry",
      hp: PieceType.INFANTRY.config.maxHp * 278,
      stackCount: 278,
      maxHp: PieceType.INFANTRY.config.maxHp * 278,
      movementPoints: PieceType.INFANTRY.config.movement,
    };
    const heavyDefender: PieceSnapshot = {
      id: 2,
      panelPosition: snapshotPosition(1, 0),
      initialPosition: snapshotPosition(1, 0),
      targetPosition: undefined,
      player: "opponent",
      pieceType: "heavy",
      hp: PieceType.HEAVY.config.maxHp,
      stackCount: 1,
      maxHp: PieceType.HEAVY.config.maxHp,
      movementPoints: PieceType.HEAVY.config.movement,
    };
    const nobleDefender: PieceSnapshot = {
      id: 3,
      panelPosition: snapshotPosition(1, 0),
      initialPosition: snapshotPosition(1, 0),
      targetPosition: undefined,
      player: "opponent",
      pieceType: "noble",
      hp: PieceType.NOBLE.config.maxHp,
      stackCount: 1,
      maxHp: PieceType.NOBLE.config.maxHp,
      movementPoints: PieceType.NOBLE.config.movement,
    };
    const target = new PanelPosition(snapshotPosition(1, 0));
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
          panelState: "occupied",
          player: "opponent",
          resource: 0,
          castle: 10,
        },
      ],
      pieces: [piece, heavyDefender, nobleDefender],
    });

    const score = scoreTarget(gameState, piece, target, createProfile("standard"), [target]);

    expect(score).toBeGreaterThan(0);
  });

  test("aggressive combatAssertiveness still attacks a self-reinforcing defender a lone piece can't out-margin", () => {
    // Regression test for a second bug found via live AI-vs-AI playtesting: once a
    // castle is fully breached, a defending stack that keeps merging (e.g. a Heavy
    // pile that grows every turn) can out-scale any single attacking piece/stack's
    // raw damage forever, even though that attacker would easily survive the
    // defender's counterattack (comfortable HP margin) and, combined with other
    // nearby friendly pieces the AI never accounts for, would actually win. Without
    // "aggressive" softening attackMargin's weight, the AI stalls out permanently
    // comparing its lone damage against the defender's ever-growing total HP.
    const piece: PieceSnapshot = {
      id: 1,
      panelPosition: snapshotPosition(0, 0),
      initialPosition: snapshotPosition(0, 0),
      targetPosition: undefined,
      player: "self",
      pieceType: "infantry",
      hp: PieceType.INFANTRY.config.maxHp * 29,
      stackCount: 29,
      maxHp: PieceType.INFANTRY.config.maxHp * 29,
      movementPoints: PieceType.INFANTRY.config.movement,
    };
    const heavyDefender: PieceSnapshot = {
      id: 2,
      panelPosition: snapshotPosition(1, 0),
      initialPosition: snapshotPosition(1, 0),
      targetPosition: undefined,
      player: "opponent",
      pieceType: "heavy",
      hp: PieceType.HEAVY.config.maxHp * 17,
      stackCount: 17,
      maxHp: PieceType.HEAVY.config.maxHp * 17,
      movementPoints: PieceType.HEAVY.config.movement,
    };
    const target = new PanelPosition(snapshotPosition(1, 0));
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
          panelState: "occupied",
          player: "opponent",
          resource: 0,
          castle: 0,
        },
      ],
      pieces: [piece, heavyDefender],
    });

    const standardScore = scoreTarget(gameState, piece, target, createProfile("standard"), [
      target,
    ]);
    const aggressiveScore = scoreTarget(gameState, piece, target, createProfile("aggressive"), [
      target,
    ]);

    expect(standardScore).toBeLessThan(0);
    expect(aggressiveScore).toBeGreaterThan(0);
  });
});
