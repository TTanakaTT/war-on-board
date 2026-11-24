import { describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { createPiece, samePos, Terrain, type GameState, type Piece } from "#lib/domain/model.ts";
import { InvariantService as I } from "#lib/services/InvariantService.ts";
import { newGame, pos, SIDES } from "../helpers.ts";

const piece = (id: number, overrides: Partial<Piece> = {}) =>
  createPiece({
    id,
    panelPosition: pos(0, 0),
    player: "self",
    pieceType: "infantry",
    ...overrides,
  });
const state = (pieces: Piece[] = [], change: (s: GameState) => void = () => {}): GameState => {
  newGame(4);
  const s = GameApi.getGameState();
  s.pieces = pieces;
  change(s);
  return s;
};
const keys = (s: GameState) => I.check(s).map((v) => v.key);

describe("InvariantService", () => {
  test("a new game is clean", () => {
    expect(I.check(state())).toEqual([]);
  });

  test.each<[string, Piece[], string[]]>([
    [
      "capacity",
      [piece(1), piece(2, { pieceType: "archer" }), piece(3, { pieceType: "rook" })],
      ["piece-capacity-exceeded:0,0:self"],
    ],
    ["mixed players", [piece(1), piece(2, { player: "opponent" })], ["mixed-players-on-panel:0,0"]],
    ["no HP", [piece(1, { hp: 0 })], ["piece-hp-out-of-range:1"]],
    ["negative points", [piece(1, { movementPoints: -1 })], ["movement-points-out-of-range:1"]],
    ["duplicate ids", [piece(1), piece(1, { panelPosition: pos(0, 1) })], ["duplicate-piece-id:1"]],
    [
      "off board",
      [piece(1, { rangedAttackTargetPosition: pos(99, 99), transitPosition: pos(99, 99) })],
      ["piece-off-board:1:rangedAttackTargetPosition", "piece-off-board:1:transitPosition"],
    ],
    ["unmerged", [piece(1), piece(2)], ["unmerged-pieces:0,0:self:infantry"]],
  ])("reports %s", (_, pieces, expected) => {
    expect(keys(state(pieces))).toEqual(expected);
  });

  test("reports a piece on a mountain as off board", () => {
    const onMountain = state([piece(1)], (s) => {
      s.panels = s.panels.map((p) =>
        samePos(p.panelPosition, pos(0, 0)) ? { ...p, terrain: Terrain.MOUNTAIN } : p,
      );
    });
    expect(keys(onMountain)).toEqual(["piece-off-board:1:panelPosition"]);
  });

  test("a heavy in transit is not counted as unmerged; negative resources are reported", () => {
    const heavy = (id: number, extra = {}) => piece(id, { pieceType: "heavy", ...extra });
    expect(
      I.check(state([heavy(1), heavy(2, { transitPosition: pos(0, 1), hopProgress: 0.5 })])),
    ).toEqual([]);
    expect(keys(state([], (s) => (s.turn.resources.opponent = -1)))).toEqual([
      "negative-resources:opponent",
    ]);
  });

  test("findIntroducedViolations skips existing keys and flags changes after a winner", () => {
    const before = state([piece(1, { hp: 0 })]);
    const after = {
      ...before,
      pieces: [...before.pieces, piece(2, { movementPoints: -1, panelPosition: pos(0, 1) })],
    };
    expect(I.findIntroducedViolations(before, after).map((v) => v.key)).toEqual([
      "movement-points-out-of-range:2",
    ]);

    const finished = state([], (s) => (s.turn.winner = "self"));
    expect(I.findIntroducedViolations(finished, structuredClone(finished))).toEqual([]);
    const changed = structuredClone(finished);
    changed.turn.resources.self = 999;
    expect(I.findIntroducedViolations(finished, changed).map((v) => v.type)).toEqual([
      "state-changed-after-winner",
    ]);
  });
});

describe.each(SIDES)("InvariantService home base (%s)", (player) => {
  const home = pos(player === "self" ? -3 : 3, 0);
  const rooks = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      piece(i + 1, { player, panelPosition: home, pieceType: "rook" }),
    );

  test("a home base holds three non-mergeable pieces, not four", () => {
    expect(keys(state(rooks(3)))).toEqual([]);
    expect(keys(state(rooks(4)))).toEqual([
      `piece-capacity-exceeded:${home.horizontalLayer},0:${player}`,
    ]);
  });
});
