import { AiStrength } from "$lib/domain/enums/AiStrength";
import { DEFAULT_AUTOMATION_TURN_LIMIT } from "$lib/domain/constants/GameConstants";
import type { MatchControl } from "$lib/domain/types/match";

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
