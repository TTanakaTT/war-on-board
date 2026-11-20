import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createPiece,
  opponentOf,
  PieceType,
  Player,
  type PanelPosition,
  type Piece,
} from "#lib/domain/model.ts";
import { MovementRulesService as M, type TurnStep } from "#lib/services/MovementRulesService.ts";
import { PanelRepository } from "#lib/store.svelte.ts";
import { add, fill, newGame, pos, setPanel, SIDES } from "../helpers.ts";

const MAX = 2;
beforeEach(() => newGame(5));
afterEach(() => vi.restoreAllMocks());

describe("basic rules", () => {
  test("enemy presence: enemy pieces or an enemy wall", () => {
    add(1, pos(1, 0), Player.OPPONENT);
    add(2, pos(0, 1));
    setPanel(pos(2, 0), { player: Player.OPPONENT, wall: 1 });
    expect(
      [pos(1, 0), pos(2, 0), pos(0, 1), pos(0, 0)].map((p) => M.hasEnemyPresence(p, Player.SELF)),
    ).toEqual([true, true, false, false]);
  });

  test("defense gate: every defender's defense <= the attacker's raw attack (merge ignored)", () => {
    const rook = add(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ROOK, stackCount: 3 });
    const siege = add(2, pos(1, 0), Player.OPPONENT, { pieceType: PieceType.SIEGE });
    const infantry = add(3, pos(1, 0), Player.OPPONENT);
    expect(M.canDefeatAllDefenders(rook, [infantry])).toBe(true);
    expect(M.canDefeatAllDefenders(rook, [infantry, siege])).toBe(false);
    expect(M.canMoveTo(pos(1, 0), Player.SELF, 1)).toBe(false);
  });

  test("pieces that cannot attack never target enemies; walls are not gated by defense", () => {
    add(1, pos(0, 0), Player.SELF, { pieceType: PieceType.NOBLE });
    add(2, pos(1, 0), Player.OPPONENT);
    setPanel(pos(0, 1), { player: Player.OPPONENT, wall: 5 });
    add(3, pos(-1, 0), Player.SELF, { pieceType: PieceType.ROOK });
    expect(M.canMoveTo(pos(1, 0), Player.SELF, 1)).toBe(false);
    expect(M.canMoveTo(pos(0, 1), Player.SELF, 3)).toBe(true);
  });

  test("capacity counts each mergeable type once, incoming orders included", () => {
    add(1, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
    add(2, pos(0, 1), Player.SELF, { targetPosition: pos(1, 0) });
    add(3, pos(0, 0));
    add(4, pos(1, 1), Player.SELF, { pieceType: PieceType.NOBLE });
    expect(M.planEndOfTurn(Player.SELF, MAX).stackCount(pos(1, 0))).toBe(2);
    expect(M.canMoveTo(pos(1, 0), Player.SELF, 3)).toBe(true);
    expect(M.canMoveTo(pos(1, 0), Player.SELF, 4)).toBe(false);
    add(5, pos(1, 0), Player.OPPONENT);
    expect(M.canMoveTo(pos(1, 0), Player.SELF, 3)).toBe(true);
  });

  test("staying on a full panel works when residents merge", () => {
    add(1, pos(1, 0));
    add(2, pos(1, 0));
    add(3, pos(1, 0), Player.SELF, { pieceType: PieceType.ROOK });
    expect(M.canMoveTo(pos(1, 0), Player.SELF, 1)).toBe(true);
  });

  test("cancel needs room to stay, merges included", () => {
    add(1, pos(0, 0), Player.SELF, { targetPosition: pos(1, 0) });
    add(2, pos(-1, 0), Player.SELF, { pieceType: PieceType.ROOK, targetPosition: pos(0, 0) });
    add(3, pos(0, 0), Player.SELF, { pieceType: PieceType.NOBLE });
    expect(M.canCancelMove(Player.SELF, 1)).toBe(false);
    add(4, pos(1, 1), Player.SELF, { targetPosition: pos(1, 2) });
    add(5, pos(1, 1));
    add(6, pos(1, 1), Player.SELF, { pieceType: PieceType.ROOK });
    expect(M.canCancelMove(Player.SELF, 4)).toBe(true);
  });

  test("ranged attacks need distance 2..range, enemies, no wall", () => {
    add(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
    add(2, pos(0, 1), Player.SELF);
    add(3, pos(1, 0), Player.OPPONENT);
    expect(M.canRangedAttack(1, pos(1, 0))).toBe(false);
    expect(M.canRangedAttack(1, pos(2, 0))).toBe(false);
    add(4, pos(2, 0), Player.OPPONENT);
    expect(M.canRangedAttack(1, pos(2, 0))).toBe(true);
    expect(M.canRangedAttack(2, pos(2, 0))).toBe(false);
    expect(M.canRangedAttack(99, pos(2, 0))).toBe(false);
    setPanel(pos(2, 0), { player: Player.OPPONENT, wall: 5 });
    expect(M.canRangedAttack(1, pos(2, 0))).toBe(false);
  });

  test("cancelsOrder: blocked, or attacking something other than the target", () => {
    const piece = add(1, pos(-1, 0), Player.SELF, { targetPosition: pos(1, 0) });
    const cancelling: TurnStep[] = [
      { kind: "blocked", path: [] },
      { kind: "attack", path: [], target: pos(0, 0) },
      { kind: "windUp", target: pos(0, 0) },
    ];
    const keeping: TurnStep[] = [
      { kind: "attack", path: [pos(0, 0)], target: pos(1, 0) },
      { kind: "windUp", target: pos(1, 0) },
      { kind: "idle" },
      { kind: "advance", path: [pos(0, 0)] },
      { kind: "continueTransit" },
    ];
    expect(cancelling.every((s) => M.cancelsOrder(s, piece))).toBe(true);
    expect(keeping.some((s) => M.cancelsOrder(s, piece))).toBe(false);
  });
});

describe.each(SIDES)("slow pieces (%s)", (player) => {
  const enemy = opponentOf(player);
  const [origin, hop, beyond] = [pos(0, 0), pos(0, 1), pos(0, 2)];
  const heavy = (overrides: Partial<Piece> = {}) =>
    add(1, origin, player, { pieceType: PieceType.HEAVY, movementPoints: 0, ...overrides });
  const planOf = (p: Piece) => M.planEndOfTurn(player, MAX).get(p.id)!;

  test.each<[string, Partial<Piece>, TurnStep["kind"], PanelPosition[]]>([
    ["no order", {}, "idle", [origin]],
    ["ordered to its own panel", { targetPosition: origin }, "stay", [origin]],
    ["leaving", { targetPosition: beyond }, "startTransit", [origin, hop]],
    [
      "mid-hop",
      { targetPosition: beyond, transitPosition: hop, hopProgress: 0.25 },
      "continueTransit",
      [origin, hop],
    ],
    [
      "arriving",
      { targetPosition: pos(1, 0), transitPosition: hop, hopProgress: 0.5 },
      "enter",
      [hop],
    ],
  ])("%s: step and occupancy", (_, overrides, kind, occupancy) => {
    const plan = planOf(heavy(overrides));
    expect(plan.step.kind).toBe(kind);
    expect(plan.occupancy).toEqual(occupancy);
  });

  test("an enemy on the next hop keeps it on its own panel; a winding-up attack is locked", () => {
    add(10, hop, enemy);
    const winding = heavy({ targetPosition: hop, hopProgress: 0.5 });
    expect(planOf(winding).occupancy).toEqual([origin]);
    expect(M.completesHopThisTurn(winding, hop)).toBe(true);
    expect(M.isOrderLocked(winding)).toBe(true);
    expect(M.canMoveTo(origin, player, 1)).toBe(false);
    expect(M.canCancelMove(player, 1)).toBe(false);
  });

  test("not locked: fresh orders, transit, no order, or a normal piece", () => {
    expect(M.isOrderLocked(heavy({ targetPosition: hop }))).toBe(false);
    expect(
      M.isOrderLocked({
        ...heavy(),
        transitPosition: hop,
        targetPosition: hop,
        hopProgress: 0.5,
      }),
    ).toBe(false);
    expect(M.isOrderLocked({ ...heavy(), hopProgress: 0.5 })).toBe(false);
    expect(M.isOrderLocked(add(2, origin, player, { targetPosition: hop }))).toBe(false);
  });

  test("withOrder restarts progress unless in transit; normal pieces keep their points", () => {
    const reordered = M.withOrder(heavy({ targetPosition: hop, hopProgress: 0.5 }), beyond);
    expect(reordered).toMatchObject({ targetPosition: beyond });
    expect(reordered.hopProgress).toBeUndefined();
    const moving = { ...heavy(), targetPosition: hop, transitPosition: hop, hopProgress: 0.5 };
    expect(M.withOrder(moving, beyond)).toMatchObject({
      transitPosition: hop,
      hopProgress: 0.5,
    });
    expect(M.withOrder(add(2, origin, player), hop).movementPoints).toBe(1);
  });

  test("a full next hop refuses that hop but not targets beyond it", () => {
    fill(hop, 10, player);
    heavy();
    expect(M.canMoveTo(hop, player, 1)).toBe(false);
    expect(M.canMoveTo(beyond, player, 1)).toBe(true);
  });

  test("cancelling in transit stops at the hop, so its own panel's room does not matter", () => {
    fill(origin, 10, player);
    heavy({ targetPosition: beyond, transitPosition: hop, hopProgress: 0.5 });
    expect(M.canCancelMove(player, 1)).toBe(true);
    expect(M.canCancelMove(player, 99)).toBe(false);
  });

  test("an attack is refused when staying cancels a piece moving into its own panel", () => {
    add(10, hop, enemy);
    add(2, origin, player, { targetPosition: pos(-1, 0) });
    add(3, origin, player, { pieceType: PieceType.ROOK });
    add(4, pos(1, 0), player, { pieceType: PieceType.NOBLE, targetPosition: origin });
    expect(M.canMoveTo(hop, player, 2)).toBe(false);
    expect(M.canMoveTo(pos(-1, 0), player, 2)).toBe(true);
  });
});

describe.each(SIDES)("routes to distant targets (%s)", (player) => {
  const enemy = opponentOf(player);
  // (-1,0) reaches (1,0) through (0,0) (findShortestPath's route) or (0,1); all three touch.
  const [origin, onRoute, detour, target] = [pos(-1, 0), pos(0, 0), pos(0, 1), pos(1, 0)];
  const plan = () => M.planEndOfTurn(player, MAX);
  const stepOf = (id: number) => plan().get(id)!.step;
  const expectWithinCapacity = () => {
    const p = plan();
    for (const panel of PanelRepository.getAll()) {
      expect(p.stackCount(panel.panelPosition)).toBeLessThanOrEqual(MAX);
    }
  };

  test("two movers to one target split around a busy panel", () => {
    add(1, origin, player, { pieceType: PieceType.ROOK, targetPosition: target, orderSequence: 1 });
    add(2, origin, player, {
      pieceType: PieceType.NOBLE,
      targetPosition: target,
      orderSequence: 2,
    });
    add(3, onRoute, player);
    expect(stepOf(1)).toEqual({ kind: "advance", path: [onRoute] });
    expect(stepOf(2)).toEqual({ kind: "advance", path: [detour] });
    expectWithinCapacity();
  });

  test("other shortest routes are taken around full panels", () => {
    fill(onRoute, 10, player);
    add(1, origin, player, { targetPosition: target });
    add(2, origin, player, { pieceType: PieceType.CAVALRY, targetPosition: target });
    add(3, origin, player, {
      pieceType: PieceType.HEAVY,
      targetPosition: target,
      movementPoints: 0,
    });
    expect(stepOf(1)).toEqual({ kind: "advance", path: [detour] });
    expect(stepOf(2)).toEqual({ kind: "enter", path: [detour, target] });
    expect(stepOf(3)).toEqual({ kind: "startTransit", hop: detour });
  });

  test("blocked on every route, a cavalry walks as far as it can", () => {
    fill(pos(1, 0), 10, player);
    fill(pos(1, 1), 20, player);
    add(1, origin, player, { pieceType: PieceType.CAVALRY, targetPosition: pos(2, 0) });
    expect(stepOf(1)).toEqual({ kind: "blocked", path: [onRoute] });
  });

  test("enemies on the route: attackers attack, others go around", () => {
    add(20, onRoute, enemy);
    add(1, origin, player, { targetPosition: target });
    add(2, origin, player, { pieceType: PieceType.NOBLE, targetPosition: target });
    expect(stepOf(1)).toEqual({ kind: "attack", path: [], target: onRoute });
    expect(stepOf(2)).toEqual({ kind: "advance", path: [detour] });
  });

  test("a rook goes around a siege it cannot beat and is blocked when the siege is its target", () => {
    add(20, onRoute, enemy, { pieceType: PieceType.SIEGE });
    add(1, origin, player, { pieceType: PieceType.ROOK, targetPosition: target });
    add(2, origin, player, { pieceType: PieceType.ROOK, targetPosition: onRoute });
    expect(stepOf(1)).toEqual({ kind: "advance", path: [detour] });
    expect(stepOf(2)).toEqual({ kind: "blocked", path: [] });
  });

  test("a full friendly target blocks", () => {
    fill(onRoute, 10, player);
    add(1, origin, player, { targetPosition: onRoute });
    expect(stepOf(1)).toEqual({ kind: "blocked", path: [] });
  });

  test("an earlier mover enters a panel a later mover leaves", () => {
    add(10, onRoute, player, { pieceType: PieceType.ROOK });
    add(11, onRoute, player, {
      pieceType: PieceType.NOBLE,
      targetPosition: target,
      orderSequence: 2,
    });
    add(1, origin, player, { targetPosition: onRoute, orderSequence: 1 });
    expect(stepOf(1)).toEqual({ kind: "enter", path: [onRoute] });
    expect(stepOf(11)).toEqual({ kind: "enter", path: [target] });
    expectWithinCapacity();
  });

  test("movers trade places, also through another shortest route", () => {
    add(1, origin, player, { targetPosition: target, orderSequence: 1 });
    add(10, origin, player, { pieceType: PieceType.ROOK });
    fill(onRoute, 11, player);
    add(2, detour, player, {
      pieceType: PieceType.NOBLE,
      targetPosition: origin,
      orderSequence: 2,
    });
    add(13, detour, player, { pieceType: PieceType.ROOK });
    expect(stepOf(1)).toEqual({ kind: "advance", path: [detour] });
    expect(stepOf(2)).toEqual({ kind: "enter", path: [origin] });
    expectWithinCapacity();
  });

  test("three movers trade places in a cycle", () => {
    const panels = [origin, onRoute, detour];
    panels.forEach((p, i) => {
      add(i + 1, p, player, {
        pieceType: PieceType.NOBLE,
        targetPosition: panels[(i + 1) % 3],
        orderSequence: i + 1,
      });
      add(i + 10, p, player, { pieceType: PieceType.ROOK });
    });
    panels.forEach((_, i) =>
      expect(stepOf(i + 1)).toEqual({ kind: "enter", path: [panels[(i + 1) % 3]] }),
    );
    expectWithinCapacity();
  });

  test("a heavy in transit turns back when an enemy it cannot beat enters its hop", () => {
    add(1, origin, player, {
      pieceType: PieceType.HEAVY,
      targetPosition: target,
      transitPosition: detour,
      movementPoints: 0,
    });
    add(20, detour, enemy);
    vi.spyOn(M, "canDefeatAllDefenders").mockReturnValue(false);
    expect(stepOf(1)).toEqual({ kind: "blocked", path: [] });
  });

  test("this turn's reach follows movement points; heavies reach adjacent panels; transit none", () => {
    const reach = (p: Piece, h: number, v: number) => M.isWithinThisTurnsReach(p, pos(h, v));
    const cavalry = add(1, onRoute, player, { pieceType: PieceType.CAVALRY });
    const tired = add(2, onRoute, player, { movementPoints: 0 });
    const slow = add(3, onRoute, player, { pieceType: PieceType.HEAVY, movementPoints: 0 });
    const moving = { ...slow, transitPosition: detour, targetPosition: pos(0, 2) };
    expect([reach(cavalry, 0, 2), reach(cavalry, 0, 3)]).toEqual([true, false]);
    expect(reach(tired, 0, 1)).toBe(false);
    expect([reach(slow, 0, 1), reach(slow, 0, 2)]).toEqual([true, false]);
    expect([reach(moving, 0, 1), reach(moving, 0, 0)]).toEqual([false, false]);
  });

  test("targets beyond reach are always allowed; within reach they must be carried out", () => {
    fill(target, 10, player);
    add(1, origin, player);
    expect(M.canMoveTo(target, player, 1)).toBe(true);

    add(20, pos(1, 2), enemy);
    add(2, origin, player, { pieceType: PieceType.NOBLE });
    expect(M.canMoveTo(pos(1, 2), player, 2)).toBe(true);

    fill(onRoute, 30, player);
    add(3, origin, player, { pieceType: PieceType.CAVALRY });
    expect(M.canMoveTo(pos(1, 1), player, 3)).toBe(true);
    fill(detour, 40, player);
    expect(M.canMoveTo(pos(1, 1), player, 3)).toBe(false);
  });

  test("a move within reach may not cancel another piece's order", () => {
    add(10, detour, player, { pieceType: PieceType.ROOK });
    add(2, origin, player, {
      pieceType: PieceType.NOBLE,
      targetPosition: detour,
      orderSequence: 2,
    });
    add(1, onRoute, player, { orderSequence: 1 });
    expect(M.canMoveTo(pos(0, 2), player, 1)).toBe(true);
    expect(M.canMoveTo(detour, player, 1)).toBe(false);
  });

  test("canPlaceNewPiece respects end-of-turn room and orders in progress", () => {
    const rook = (p: PanelPosition) =>
      createPiece({ id: 99, panelPosition: p, player, pieceType: PieceType.ROOK });
    add(10, onRoute, player, { pieceType: PieceType.ROOK });
    expect(M.canPlaceNewPiece(rook(onRoute), MAX)).toBe(true);
    add(1, origin, player, { pieceType: PieceType.NOBLE, targetPosition: onRoute });
    expect(M.canPlaceNewPiece(rook(onRoute), MAX)).toBe(false);
    expect(M.canPlaceNewPiece(rook(detour), MAX)).toBe(true);
    add(11, detour, player, { pieceType: PieceType.ROOK });
    add(12, detour, player, { pieceType: PieceType.NOBLE, targetPosition: target });
    expect(M.canPlaceNewPiece(rook(detour), MAX)).toBe(true);
  });
});
