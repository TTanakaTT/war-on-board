import { describe, expect, test } from "vitest";
import {
  createGameApiClient,
  type GameApiCommandDelegate,
  type GameApiLogEntry,
} from "$lib/api/GameApiClient";
import { PanelPosition } from "$lib/domain/entities/PanelPosition";
import { ActionError } from "$lib/domain/enums/ActionError";
import { Player } from "$lib/domain/enums/Player";
import type { GameStateSnapshot, Result, TurnEndResult } from "$lib/domain/types/api";

function createGameStateSnapshot(): GameStateSnapshot {
  return {
    panels: [],
    pieces: [],
    turn: {
      num: 1,
      player: "self",
      resources: { self: 10, opponent: 5 },
      maxPiecesPerPanel: { self: 2, opponent: 2 },
      generationMode: { self: "front", opponent: "front" },
      winner: null,
    },
    homeBases: [
      { player: "self", panelPosition: { horizontalLayer: -3, verticalLayer: 0 } },
      { player: "opponent", panelPosition: { horizontalLayer: 3, verticalLayer: 0 } },
    ],
    layer: 4,
  };
}

function createSuccessResult(): Result<{ gameState: GameStateSnapshot }> {
  return {
    ok: true,
    value: {
      gameState: createGameStateSnapshot(),
    },
  };
}

function createEndTurnSuccessResult(): Result<TurnEndResult> {
  return {
    ok: true,
    value: {
      combatOutcomes: [],
      winner: null,
      nextPlayer: Player.OPPONENT,
      gameState: createGameStateSnapshot(),
    },
  };
}

function createDelegate(overrides: Partial<GameApiCommandDelegate> = {}): GameApiCommandDelegate {
  return {
    initializeGame: overrides.initializeGame ?? (() => createSuccessResult()),
    assignMove: overrides.assignMove ?? (() => createSuccessResult()),
    cancelMove: overrides.cancelMove ?? (() => createSuccessResult()),
    generatePiece: overrides.generatePiece ?? (() => createSuccessResult()),
    setGenerationMode: overrides.setGenerationMode ?? (() => createSuccessResult()),
    endTurn: overrides.endTurn ?? (() => createEndTurnSuccessResult()),
  };
}

describe("GameApiClient logger", () => {
  test("when dev=true and a command succeeds, logs request and success response", () => {
    const entries: GameApiLogEntry[] = [];
    const result = createSuccessResult();
    const delegate = createDelegate({
      initializeGame: () => result,
    });
    const client = createGameApiClient({
      isDev: true,
      delegate,
      logger: (entry) => entries.push(entry),
    });

    const response = client.initializeGame({ layer: 4 });

    expect(response).toBe(result);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      transport: "gameapi",
      phase: "request",
      operation: "initializeGame",
      args: [{ layer: 4 }],
    });
    expect(entries[1]).toEqual({
      transport: "gameapi",
      phase: "response",
      operation: "initializeGame",
      result: {
        ok: true,
        summary: {
          turn: {
            num: 1,
            player: "self",
            winner: null,
          },
        },
      },
    });
    expect(entries[1]).not.toHaveProperty("result.gameState");
  });

  test("when dev=true and a command returns an error result, logs request and error response", () => {
    const entries: GameApiLogEntry[] = [];
    const target = new PanelPosition({ horizontalLayer: -2, verticalLayer: 0 });
    const result = { ok: false, error: ActionError.NOT_YOUR_TURN } as const;
    const delegate = createDelegate({
      assignMove: () => result,
    });
    const client = createGameApiClient({
      isDev: true,
      delegate,
      logger: (entry) => entries.push(entry),
    });

    const response = client.assignMove(Player.SELF, 7, target);

    expect(response).toBe(result);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      transport: "gameapi",
      phase: "request",
      operation: "assignMove",
      args: [Player.SELF, 7, target],
    });
    expect(entries[1]).toEqual({
      transport: "gameapi",
      phase: "response",
      operation: "assignMove",
      result: {
        ok: false,
        error: String(ActionError.NOT_YOUR_TURN),
      },
    });
  });

  test("when dev=false, commands do not emit info logs regardless of success or error", () => {
    const entries: GameApiLogEntry[] = [];
    const successResult = createSuccessResult();
    const errorResult = { ok: false, error: ActionError.NOT_YOUR_TURN } as const;
    const delegate = createDelegate({
      initializeGame: () => successResult,
      assignMove: () => errorResult,
    });
    const client = createGameApiClient({
      isDev: false,
      delegate,
      logger: (entry) => entries.push(entry),
    });

    const initializeResponse = client.initializeGame({ layer: 4 });
    const assignResponse = client.assignMove(
      Player.SELF,
      7,
      new PanelPosition({ horizontalLayer: -2, verticalLayer: 0 }),
    );

    expect(initializeResponse).toBe(successResult);
    expect(assignResponse).toBe(errorResult);
    expect(entries).toEqual([]);
  });
});
