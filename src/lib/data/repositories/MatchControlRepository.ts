import { matchControlState } from "$lib/data/state/MatchControlState.svelte";
import type {
  MatchAiStrengths,
  MatchAutomationState,
  MatchControl,
  MatchControllers,
} from "$lib/domain/types/match";

export class MatchControlRepository {
  static get(): MatchControl {
    const matchControl = matchControlState.get();

    return {
      mode: matchControl.mode,
      controllers: this.cloneControllers(matchControl.controllers),
      aiStrengths: this.cloneAiStrengths(matchControl.aiStrengths),
      automation: this.cloneAutomation(matchControl.automation),
    };
  }

  static set(matchControl: MatchControl): void {
    matchControlState.set({
      mode: matchControl.mode,
      controllers: this.cloneControllers(matchControl.controllers),
      aiStrengths: this.cloneAiStrengths(matchControl.aiStrengths),
      automation: this.cloneAutomation(matchControl.automation),
    });
  }

  private static cloneControllers(controllers: MatchControllers): MatchControllers {
    return {
      self: controllers.self,
      opponent: controllers.opponent,
    };
  }

  private static cloneAiStrengths(aiStrengths: MatchAiStrengths): MatchAiStrengths {
    return {
      self: aiStrengths.self,
      opponent: aiStrengths.opponent,
    };
  }

  private static cloneAutomation(automation: MatchAutomationState): MatchAutomationState {
    return {
      status: automation.status,
      automatedTurns: automation.automatedTurns,
      turnLimit: automation.turnLimit,
      stopReason: automation.stopReason,
      stoppedAtWinner: automation.stoppedAtWinner,
    };
  }
}
