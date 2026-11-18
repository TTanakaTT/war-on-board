import { GameApi } from "#lib/api/GameApi.ts";

const COMMANDS = [
  "initializeGame",
  "assignMove",
  "cancelMove",
  "assignRangedAttack",
  "cancelRangedAttack",
  "generatePiece",
  "setGenerationMode",
  "endTurn",
] as const;

export type GameApiCommandName = (typeof COMMANDS)[number];
export type GameApiCommandInterceptor = <T>(
  operation: GameApiCommandName,
  args: unknown[],
  execute: () => T,
) => T;

let interceptor: GameApiCommandInterceptor | null = null;

/**
 * GameApi commands issued by players (UI and CPU). Debug mode observes them through the
 * interceptor; internal simulations call GameApi directly so they are not observed.
 */
export const GameApiClient = {
  setInterceptor(next: GameApiCommandInterceptor | null) {
    interceptor = next;
  },
  ...(Object.fromEntries(
    COMMANDS.map((operation) => [
      operation,
      (...args: unknown[]) => {
        const execute = () => Reflect.apply(GameApi[operation], GameApi, args);
        return interceptor ? interceptor(operation, args, execute) : execute();
      },
    ]),
  ) as Pick<typeof GameApi, GameApiCommandName>),
};
