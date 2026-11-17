import { AiStrength } from "#lib/domain/enums/AiStrength.ts";
import { DEFAULT_AUTOMATION_TURN_LIMIT } from "#lib/domain/constants/GameConstants.ts";
import type { MatchControl } from "#lib/domain/types/match.ts";

let _matchControl = $state<MatchControl>({
  mode: "human-vs-cpu",
  controllers: {
    self: "human",
    opponent: "cpu",
  },
  aiStrengths: {
    self: AiStrength.STRENGTH_1,
    opponent: AiStrength.STRENGTH_1,
  },
  // Never used in practice: the match screen always goes through MatchService.startMatch.
  aiSeeds: {
    self: 0,
    opponent: 0,
  },
  automation: {
    status: "idle",
    automatedTurns: 0,
    turnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
    stopReason: null,
    stoppedAtWinner: null,
  },
});

function get(): MatchControl {
  return _matchControl;
}

function set(matchControl: MatchControl): void {
  _matchControl = matchControl;
}

export const matchControlState = {
  get,
  set,
};
