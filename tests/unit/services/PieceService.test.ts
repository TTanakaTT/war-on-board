import { beforeEach, describe, expect, test } from "vitest";
import {
  isAdjacent,
  opponentOf,
  pieceConfig,
  PieceType,
  wallAttackPower,
  type PanelPosition,
} from "#lib/domain/model.ts";
import { PieceService } from "#lib/services/PieceService.ts";
import { PanelRepository, PiecesRepository } from "#lib/store.svelte.ts";
import { add, exists, fill, newGame, panel, piece, pos, setPanel, SIDES } from "../helpers.ts";

const onPanel = (p: PanelPosition) => ({ from: p, to: p, progress: 0 });
const neighborsOf = (p: PanelPosition) =>
  PanelRepository.getAll()
    .map((x) => x.panelPosition)
    .filter((x) => isAdjacent(x, p));

beforeEach(() => newGame(4));

describe("basics", () => {
  test("generateNextId is the highest id + 1", () => {
    expect(PieceService.generateNextId()).toBe(1);
    add(7, pos(0, 0));
    expect(PieceService.generateNextId()).toBe(8);
  });

  test("move relocates, clears orders and spends a hop", () => {
    add(1, pos(0, 0), "self", { targetPosition: pos(0, 1), rangedAttackTargetPosition: pos(0, 2) });
    PieceService.move(pos(0, 1), piece(1));
    expect(piece(1)).toMatchObject({
      panelPosition: pos(0, 1),
      initialPosition: pos(0, 1),
      targetPosition: undefined,
      rangedAttackTargetPosition: undefined,
      movementPoints: 0,
    });
  });

  test.each([
    [0, 1, 1],
    [0, 2, 2],
    [0, 0.5, 0.5],
    [0.5, 0.5, 1],
    [1, 0.25, 1],
  ])("accrued points from %s at rate %s = %s", (current, rate, expected) => {
    expect(PieceService.computeAccruedMovementPoints(current, rate)).toBe(expected);
  });

  test("accrual refills own non-slow pieces only", () => {
    add(1, pos(0, 0), "self", { movementPoints: 0 });
    add(2, pos(1, 0), "self", { pieceType: PieceType.HEAVY, movementPoints: 0.5 });
    add(3, pos(2, 0), "opponent", { movementPoints: 0 });
    PieceService.accrueMovementForPlayer("self");
    expect([1, 2, 3].map((id) => piece(id).movementPoints)).toEqual([1, 0.5, 0]);
  });

  test("passives: Noble +1 resource (capped), Rook +1 wall (never lowered), others claim", () => {
    setPanel(pos(0, 0), { resource: 5 });
    setPanel(pos(0, 1), { wall: 1 });
    setPanel(pos(1, 0), { wall: 9 });
    add(1, pos(0, 0), "self", { pieceType: PieceType.NOBLE });
    add(2, pos(0, 1), "self", { pieceType: PieceType.ROOK });
    add(3, pos(1, 0), "self", { pieceType: PieceType.ROOK });
    add(4, pos(0, 2), "self", { pieceType: PieceType.ARCHER });
    PieceService.applyPassiveGains("self");
    expect(panel(pos(0, 0)).resource).toBe(5);
    expect(panel(pos(0, 1)).wall).toBe(2);
    expect(panel(pos(1, 0)).wall).toBe(9);
    expect(panel(pos(0, 2)).player).toBe("self");
  });
});

describe("merging", () => {
  test("same-player mergeable pieces merge into the lowest id", () => {
    add(3, pos(0, 0), "self", { hp: 4 });
    add(1, pos(0, 0));
    add(2, pos(0, 0));
    add(4, pos(0, 0), "self", { pieceType: PieceType.NOBLE });
    add(5, pos(0, 0), "self", { pieceType: PieceType.NOBLE });
    add(6, pos(0, 0), "opponent");
    PieceService.mergePiecesAtPosition(pos(0, 0));
    expect(piece(1)).toMatchObject({ stackCount: 3, hp: 24, maxHp: 30 });
    expect(pieceConfig(piece(1).pieceType).attackPowerAgainstPiece).toBe(5);
    expect(wallAttackPower(piece(1))).toBe(3);
    expect([2, 3].some(exists)).toBe(false);
    expect([4, 5, 6].every(exists)).toBe(true);
  });

  test("mergeAllPiecesForPlayer covers every panel of that player only", () => {
    add(1, pos(0, 0));
    add(2, pos(0, 0));
    add(3, pos(1, 0));
    add(4, pos(1, 0));
    add(5, pos(2, 0), "opponent");
    add(6, pos(2, 0), "opponent");
    PieceService.mergeAllPiecesForPlayer("self");
    expect(PiecesRepository.getAll().map((p) => p.id)).toEqual([1, 3, 5, 6]);
  });
});

describe.each(SIDES)("finalizePlayerMoves (%s)", (player) => {
  const enemy = opponentOf(player);

  test("moves into an empty target and keeps distant orders", () => {
    add(1, pos(0, 0), player, { targetPosition: pos(0, 1) });
    add(2, pos(-2, 0), player, { targetPosition: pos(1, 0) });
    expect(PieceService.finalizePlayerMoves(player)).toEqual([]);
    expect(piece(1).panelPosition).toEqual(pos(0, 1));
    expect(piece(2)).toMatchObject({ panelPosition: pos(-1, 0), targetPosition: pos(1, 0) });
  });

  test("a piece without a full hop waits with its order", () => {
    add(1, pos(0, 0), player, { targetPosition: pos(0, 1), movementPoints: 0.5 });
    PieceService.finalizePlayerMoves(player);
    expect(piece(1)).toMatchObject({ panelPosition: pos(0, 0), targetPosition: pos(0, 1) });
  });

  test("a cavalry reaches a defended panel two hops away and attacks it", () => {
    add(1, pos(-1, 0), player, { pieceType: PieceType.CAVALRY, targetPosition: pos(1, 0) });
    add(2, pos(1, 0), enemy, { pieceType: PieceType.NOBLE });
    const [outcome] = PieceService.finalizePlayerMoves(player);
    expect(outcome).toMatchObject({ targetPosition: pos(1, 0), entered: true });
    expect(piece(1).panelPosition).toEqual(pos(1, 0));
  });

  test("a failed attack stays, clears the order and still spends the hop", () => {
    add(1, pos(0, 0), player, { targetPosition: pos(0, 1) });
    add(2, pos(0, 1), enemy, { pieceType: PieceType.ROOK, hp: 30, maxHp: 30 });
    PieceService.finalizePlayerMoves(player);
    expect(piece(1)).toMatchObject({ panelPosition: pos(0, 0), movementPoints: 0 });
    expect(piece(1).targetPosition).toBeUndefined();
  });

  test("attackers of one panel fight together", () => {
    add(1, pos(0, 0), player, { targetPosition: pos(0, 1) });
    add(2, pos(-1, 0), player, { targetPosition: pos(0, 1) });
    add(3, pos(0, 1), enemy, { hp: 8 });
    const outcomes = PieceService.finalizePlayerMoves(player);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].destroyedPieceIds).toEqual([3]);
  });

  describe("routes", () => {
    test("goes around a full panel and keeps its order", () => {
      fill(pos(0, 0), 10, player);
      add(1, pos(-1, 0), player, { targetPosition: pos(1, 0) });
      PieceService.finalizePlayerMoves(player);
      expect(piece(1)).toMatchObject({ panelPosition: pos(0, 1), targetPosition: pos(1, 0) });
      expect(PieceService.previewEndOfTurnPoint(piece(1))).toEqual(onPanel(pos(0, 1)));
    });

    test("blocked on every route, walks as far as it can and loses its order", () => {
      fill(pos(1, 0), 10, player);
      fill(pos(1, 1), 20, player);
      const cavalry = add(1, pos(-1, 0), player, {
        pieceType: PieceType.CAVALRY,
        targetPosition: pos(2, 0),
      });
      expect(PieceService.previewEndOfTurnPoint(cavalry)).toEqual(onPanel(pos(0, 0)));
      PieceService.finalizePlayerMoves(player);
      expect(piece(1)).toMatchObject({ panelPosition: pos(0, 0), movementPoints: 1 });
      expect(piece(1).targetPosition).toBeUndefined();
    });

    test("attacks an enemy panel on its route and loses its order", () => {
      add(20, pos(0, 0), enemy, { pieceType: PieceType.NOBLE, hp: 1 });
      add(1, pos(-1, 0), player, { targetPosition: pos(1, 0) });
      const [outcome] = PieceService.finalizePlayerMoves(player);
      expect(outcome.destroyedPieceIds).toEqual([20]);
      expect(piece(1).panelPosition).toEqual(pos(0, 0));
      expect(piece(1).targetPosition).toBeUndefined();
    });

    test("pieces trading places in a cycle all move", () => {
      const panels = [pos(-1, 0), pos(0, 0), pos(0, 1)];
      panels.forEach((p, i) => {
        add(i + 1, p, player, {
          pieceType: PieceType.NOBLE,
          targetPosition: panels[(i + 1) % 3],
          orderSequence: i + 1,
        });
        add(i + 10, p, player, { pieceType: PieceType.ROOK });
      });
      PieceService.finalizePlayerMoves(player);
      panels.forEach((p, i) => expect(piece(i + 1).panelPosition).toEqual(panels[(i + 1) % 3]));
    });
  });

  describe("entering a captured panel in order sequence", () => {
    const target = pos(0, 1);
    const attack = (id: number, pieceType: PieceType, at: PanelPosition, orderSequence: number) =>
      add(id, at, player, { pieceType, targetPosition: target, orderSequence });
    const expectStayed = (id: number, at: PanelPosition) =>
      expect(piece(id)).toMatchObject({
        panelPosition: at,
        targetPosition: undefined,
        movementPoints: 0,
      });

    beforeEach(() => add(50, target, enemy, { pieceType: PieceType.NOBLE }));

    test("the order sequence, not the id, decides who enters; the rest stay", () => {
      const [n1, n2, n3] = neighborsOf(target);
      attack(1, PieceType.ROOK, n1, 3);
      attack(2, PieceType.ROOK, n2, 2);
      attack(3, PieceType.ROOK, n3, 1);
      const [outcome] = PieceService.finalizePlayerMoves(player);
      expect(outcome.entered).toBe(true);
      expect([piece(2), piece(3)].map((p) => p.panelPosition)).toEqual([target, target]);
      expectStayed(1, n1);
    });

    test("a later attacker that merges still enters after one that did not fit", () => {
      const [n1, n2, n3, n4] = neighborsOf(target);
      attack(1, PieceType.INFANTRY, n1, 1);
      attack(2, PieceType.CAVALRY, n2, 2);
      attack(3, PieceType.ROOK, n3, 3);
      attack(4, PieceType.INFANTRY, n4, 4);
      PieceService.finalizePlayerMoves(player);
      expect([1, 2, 4].map((id) => piece(id).panelPosition)).toEqual([target, target, target]);
      expectStayed(3, n3);
    });
  });
});

describe.each(SIDES)("slow pieces (%s)", (player) => {
  const enemy = opponentOf(player);
  const [origin, hop, beyond] = [pos(0, 0), pos(0, 1), pos(0, 2)];
  const heavy = (overrides = {}, id = 1) =>
    add(id, origin, player, { pieceType: PieceType.HEAVY, movementPoints: 0, ...overrides });

  test("leaves into transit, keeps moving, then arrives at an intermediate panel", () => {
    heavy({ targetPosition: beyond });
    expect(PieceService.previewEndOfTurnPoint(piece(1))).toEqual({
      from: origin,
      to: hop,
      progress: 0.5,
    });
    PieceService.finalizePlayerMoves(player);
    expect(piece(1)).toMatchObject({ panelPosition: origin, transitPosition: hop });
    expect(PieceService.currentBoardPoint(piece(1))).toEqual({
      from: origin,
      to: hop,
      progress: 0.5,
    });
    PieceService.finalizePlayerMoves(player);
    expect(piece(1)).toMatchObject({
      panelPosition: hop,
      transitPosition: undefined,
      targetPosition: beyond,
      movementPoints: 0,
    });
  });

  test("an enemy in the hop is attacked on arrival; a failed attack returns home", () => {
    add(10, hop, enemy);
    heavy({ targetPosition: beyond, transitPosition: hop, movementPoints: 0.5 });
    PieceService.finalizePlayerMoves(player);
    expect(exists(10)).toBe(true);
    expect(piece(1)).toMatchObject({
      panelPosition: origin,
      transitPosition: undefined,
      targetPosition: undefined,
    });
  });

  test("winds an attack up for a turn, then attacks", () => {
    add(10, hop, enemy, { pieceType: PieceType.NOBLE });
    heavy({ targetPosition: hop });
    PieceService.finalizePlayerMoves(player);
    expect(piece(1)).toMatchObject({ panelPosition: origin, movementPoints: 0.5 });
    expect(exists(10)).toBe(true);
    PieceService.finalizePlayerMoves(player);
    expect(exists(10)).toBe(false);
    expect(piece(1).panelPosition).toEqual(hop);
  });

  test("drops its order when the next hop has no room", () => {
    fill(hop, 10, player);
    heavy({ targetPosition: beyond });
    PieceService.finalizePlayerMoves(player);
    expect(piece(1)).toMatchObject({ panelPosition: origin, targetPosition: undefined });
  });

  test("a piece in transit is left out of merging", () => {
    heavy({ targetPosition: hop, transitPosition: hop, movementPoints: 0.5 });
    heavy({}, 2);
    PieceService.mergePiecesAtPosition(origin);
    expect([piece(1).stackCount, piece(2).stackCount]).toEqual([1, 1]);
  });
});

describe("resolveRangedAttacks", () => {
  test("archers on one target fire together without moving; empty targets are skipped", () => {
    add(1, pos(0, 0), "self", {
      pieceType: PieceType.ARCHER,
      rangedAttackTargetPosition: pos(0, 2),
    });
    add(2, pos(-1, 1), "self", {
      pieceType: PieceType.ARCHER,
      rangedAttackTargetPosition: pos(0, 2),
    });
    add(3, pos(1, 0), "self", {
      pieceType: PieceType.ARCHER,
      rangedAttackTargetPosition: pos(1, 2),
    });
    add(4, pos(0, 2), "opponent");
    const outcomes = PieceService.resolveRangedAttacks("self");
    expect(outcomes).toEqual([
      { targetPosition: pos(0, 2), destroyedPieceIds: [], entered: false, wallDamageDealt: 0 },
    ]);
    expect(piece(4).hp).toBe(10 - 2 * 3);
    expect(piece(3)).toMatchObject({ movementPoints: 0, rangedAttackTargetPosition: undefined });
  });

  test("a piece without a full hop keeps its pending attack", () => {
    add(1, pos(0, 0), "self", {
      pieceType: PieceType.ARCHER,
      rangedAttackTargetPosition: pos(0, 2),
      movementPoints: 0.5,
    });
    add(2, pos(0, 2), "opponent");
    expect(PieceService.resolveRangedAttacks("self")).toEqual([]);
    expect(piece(1).rangedAttackTargetPosition).toEqual(pos(0, 2));
  });
});
