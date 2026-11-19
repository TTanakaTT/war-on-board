import { beforeEach, describe, expect, test } from "vitest";
import { GameApi } from "#lib/api/GameApi.ts";
import { PanelState, PieceType, Player } from "#lib/domain/model.ts";
import { InteractionService as I } from "#lib/services/InteractionService.ts";
import { PanelsService } from "#lib/services/PanelService.ts";
import { SelectionRepository as S } from "#lib/store.svelte.ts";
import { add, newGame, panel, piece, pos } from "../helpers.ts";

const stateAt = (h: number, v: number) => panel(pos(h, v)).panelState;
const click = (id: number) => I.pieceChange(piece(id));

beforeEach(() => {
  newGame(4);
  S.setPieceId(undefined);
});

describe("InteractionService", () => {
  test("selecting highlights targets at any distance; selecting again deselects", () => {
    add(1, pos(-3, 0));
    PanelsService.refreshPanelStates();
    click(1);
    expect(S.getPieceId()).toBe(1);
    expect(stateAt(-3, 0)).toBe(PanelState.SELECTED);
    expect(stateAt(0, 0)).toBe(PanelState.MOVABLE);
    click(1);
    expect(S.getPieceId()).toBeUndefined();
    expect(stateAt(0, 0)).toBe(PanelState.UNOCCUPIED);
  });

  test("a noble's adjacent enemy panel is not movable, but distant enemies are", () => {
    add(1, pos(-3, 0), Player.SELF, { pieceType: PieceType.NOBLE });
    add(2, pos(-2, 0), Player.OPPONENT);
    add(3, pos(0, 0), Player.OPPONENT);
    PanelsService.refreshPanelStates();
    click(1);
    expect(stateAt(-2, 0)).not.toBe(PanelState.MOVABLE);
    expect(stateAt(0, 0)).toBe(PanelState.MOVABLE);
  });

  test("clicking a MOVABLE panel orders; clicking the SELECTED panel cancels or deselects", () => {
    add(1, pos(0, 0));
    click(1);
    I.panelChange(pos(0, 1));
    expect(piece(1).targetPosition).toEqual(pos(0, 1));
    expect(S.getPieceId()).toBeUndefined();

    click(1);
    expect(stateAt(0, 1)).toBe(PanelState.MOVABLE);
    I.panelChange(pos(1, 0));
    expect(piece(1).targetPosition).toEqual(pos(1, 0));

    click(1);
    I.panelChange(pos(0, 0));
    expect(piece(1).targetPosition).toBeUndefined();
    expect(stateAt(0, 0)).toBe(PanelState.OCCUPIED);
    click(1);
    I.panelChange(pos(0, 0));
    expect(S.getPieceId()).toBeUndefined();
  });

  test("switching between pieces, also on the same panel", () => {
    add(1, pos(0, 0));
    add(2, pos(0, 0));
    add(3, pos(0, 1));
    click(1);
    click(2);
    expect(S.getPieceId()).toBe(2);
    click(3);
    expect(S.getPieceId()).toBe(3);
    expect(stateAt(0, 0)).not.toBe(PanelState.SELECTED);
  });

  test("clicking an occupied panel selects its first idle own piece", () => {
    add(1, pos(0, 0));
    add(2, pos(0, 0));
    add(3, pos(1, 0), Player.OPPONENT);
    GameApi.assignMove(Player.SELF, 1, pos(0, 1));
    PanelsService.refreshPanelStates();
    I.panelChange(pos(0, 0));
    expect(S.getPieceId()).toBe(2);
    I.clearSelection();
    PanelsService.refreshPanelStates();
    GameApi.assignMove(Player.SELF, 2, pos(-1, 0));
    I.panelChange(pos(0, 0));
    expect(S.getPieceId()).toBe(1);
    I.clearSelection();
    PanelsService.refreshPanelStates();
    I.panelChange(pos(1, 0));
    expect(S.getPieceId()).toBeUndefined();
  });

  test("ranged mode fires at the clicked panel and is left on reselection", () => {
    add(1, pos(0, 0), Player.SELF, { pieceType: PieceType.ARCHER });
    add(2, pos(0, 1));
    add(3, pos(2, 0), Player.OPPONENT);
    I.toggleRangedAttackMode();
    expect(S.isRangedAttackMode()).toBe(false);
    click(1);
    I.toggleRangedAttackMode();
    I.panelChange(pos(2, 0));
    expect(S.isRangedAttackMode()).toBe(false);
    expect(piece(1)).toMatchObject({
      rangedAttackTargetPosition: pos(2, 0),
      panelPosition: pos(0, 0),
    });
    click(1);
    click(1);
    I.toggleRangedAttackMode();
    click(2);
    expect(S.isRangedAttackMode()).toBe(false);
  });
});
