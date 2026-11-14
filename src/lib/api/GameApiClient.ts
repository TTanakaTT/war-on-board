import { dev } from "$app/environment";
import { GameApi } from "$lib/api/GameApi";
import type { GameActionResult, Result, TurnEndResult } from "$lib/domain/types/api";

export type GameApiCommandName =
  | "initializeGame"
  | "assignMove"
  | "cancelMove"
  | "assignRangedAttack"
  | "cancelRangedAttack"
  | "generatePiece"
  | "setGenerationMode"
  | "endTurn";

type LoggedCommandResult = Result<GameActionResult> | Result<TurnEndResult>;

export type GameApiCommandDelegate = Pick<typeof GameApi, GameApiCommandName>;

interface GameApiTurnSummary {
  num: number;
  player: string;
  winner: string | null;
}

interface GameApiSuccessLogResult {
  ok: true;
  summary: {
    turn: GameApiTurnSummary;
    combatOutcomeCount?: number;
  };
}

interface GameApiErrorLogResult {
  ok: false;
  error: string;
}

export interface GameApiRequestLogEntry {
  transport: "gameapi";
  phase: "request";
  operation: GameApiCommandName;
  args: unknown[];
}

export interface GameApiResponseLogEntry {
  transport: "gameapi";
  phase: "response";
  operation: GameApiCommandName;
  result: GameApiSuccessLogResult | GameApiErrorLogResult;
}

export type GameApiLogEntry = GameApiRequestLogEntry | GameApiResponseLogEntry;

/**
 * Wraps every command: receives the command's name and arguments plus a function that runs
 * it, and must return that function's result. Lets tooling observe commands without this
 * client knowing what it does with them.
 */
export type GameApiCommandInterceptor = <TResult>(
  operation: GameApiCommandName,
  args: unknown[],
  execute: () => TResult,
) => TResult;

interface CreateGameApiClientOptions {
  isDev?: boolean;
  delegate?: GameApiCommandDelegate;
  logger?: (entry: GameApiLogEntry) => void;
}

function summarizeResult(
  result: LoggedCommandResult,
): GameApiSuccessLogResult | GameApiErrorLogResult {
  if (!result.ok) {
    return {
      ok: false,
      error: String(result.error),
    };
  }

  const summary: GameApiSuccessLogResult["summary"] = {
    turn: {
      num: result.value.gameState.turn.num,
      player: result.value.gameState.turn.player,
      winner: result.value.gameState.turn.winner,
    },
  };

  if ("combatOutcomes" in result.value) {
    summary.combatOutcomeCount = result.value.combatOutcomes.length;
  }

  return {
    ok: true,
    summary,
  };
}

function defaultLogger(entry: GameApiLogEntry): void {
  console.info("[GameApi]", entry);
}

export function createGameApiClient(options: CreateGameApiClientOptions = {}) {
  const { isDev = dev, delegate = GameApi, logger = defaultLogger } = options;
  let interceptor: GameApiCommandInterceptor | null = null;

  const log = (entry: GameApiLogEntry): void => {
    if (!isDev) {
      return;
    }

    logger(entry);
  };

  const runCommand = <TResult extends LoggedCommandResult>(
    operation: GameApiCommandName,
    args: unknown[],
    execute: () => TResult,
  ): TResult => {
    log({
      transport: "gameapi",
      phase: "request",
      operation,
      args,
    });

    const result = interceptor ? interceptor(operation, args, execute) : execute();

    log({
      transport: "gameapi",
      phase: "response",
      operation,
      result: summarizeResult(result),
    });

    return result;
  };

  return {
    /** Sets the interceptor that wraps every later command, or removes it with null. */
    setInterceptor(next: GameApiCommandInterceptor | null): void {
      interceptor = next;
    },

    initializeGame(config: Parameters<GameApiCommandDelegate["initializeGame"]>[0]) {
      return runCommand("initializeGame", [config], () => delegate.initializeGame(config));
    },

    assignMove(
      player: Parameters<GameApiCommandDelegate["assignMove"]>[0],
      pieceId: Parameters<GameApiCommandDelegate["assignMove"]>[1],
      target: Parameters<GameApiCommandDelegate["assignMove"]>[2],
    ) {
      return runCommand("assignMove", [player, pieceId, target], () =>
        delegate.assignMove(player, pieceId, target),
      );
    },

    cancelMove(
      player: Parameters<GameApiCommandDelegate["cancelMove"]>[0],
      pieceId: Parameters<GameApiCommandDelegate["cancelMove"]>[1],
    ) {
      return runCommand("cancelMove", [player, pieceId], () =>
        delegate.cancelMove(player, pieceId),
      );
    },

    assignRangedAttack(
      player: Parameters<GameApiCommandDelegate["assignRangedAttack"]>[0],
      pieceId: Parameters<GameApiCommandDelegate["assignRangedAttack"]>[1],
      target: Parameters<GameApiCommandDelegate["assignRangedAttack"]>[2],
    ) {
      return runCommand("assignRangedAttack", [player, pieceId, target], () =>
        delegate.assignRangedAttack(player, pieceId, target),
      );
    },

    cancelRangedAttack(
      player: Parameters<GameApiCommandDelegate["cancelRangedAttack"]>[0],
      pieceId: Parameters<GameApiCommandDelegate["cancelRangedAttack"]>[1],
    ) {
      return runCommand("cancelRangedAttack", [player, pieceId], () =>
        delegate.cancelRangedAttack(player, pieceId),
      );
    },

    generatePiece(
      player: Parameters<GameApiCommandDelegate["generatePiece"]>[0],
      pieceType: Parameters<GameApiCommandDelegate["generatePiece"]>[1],
    ) {
      return runCommand("generatePiece", [player, pieceType], () =>
        delegate.generatePiece(player, pieceType),
      );
    },

    setGenerationMode(
      player: Parameters<GameApiCommandDelegate["setGenerationMode"]>[0],
      mode: Parameters<GameApiCommandDelegate["setGenerationMode"]>[1],
    ) {
      return runCommand("setGenerationMode", [player, mode], () =>
        delegate.setGenerationMode(player, mode),
      );
    },

    endTurn(player: Parameters<GameApiCommandDelegate["endTurn"]>[0]) {
      return runCommand("endTurn", [player], () => delegate.endTurn(player));
    },
  };
}

export const GameApiClient = createGameApiClient();
