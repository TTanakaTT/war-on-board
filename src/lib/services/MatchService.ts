import { GameApi } from "$lib/api/GameApi";
import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
import { TurnRepository } from "$lib/data/repositories/TurnRepository";
import { DEFAULT_AUTOMATION_TURN_LIMIT } from "$lib/domain/constants/GameConstants";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { Player } from "$lib/domain/enums/Player";
import type {
  MatchAutomationState,
  MatchAiStrengths,
  MatchControl,
  MatchControllers,
  MatchMode,
  PlayerController,
  StartMatchOptions,
} from "$lib/domain/types/match";
import { AiService } from "$lib/services/AiService";

const AUTOMATION_STEP_DELAY_MS = 120;

export class MatchService {
  private static automationRunToken = 0;

  static startMatch(mode: MatchMode, options: StartMatchOptions): void {
    this.cancelScheduledAutomation();
    GameApi.initializeGame({ layer: options.layer });
    MatchControlRepository.set(
      this.createMatchControl(mode, options.automationTurnLimit, options.aiStrengths),
    );
    this.runAutomatedTurnsIfNeeded();
  }

  static runAutomatedTurnsIfNeeded(): void {
    const matchControl = MatchControlRepository.get();
    const turn = TurnRepository.get();

    if (turn.winner) {
      this.setAutomationStopped(matchControl, "winner", turn.winner);
      return;
    }

    const currentController = this.getControllerForPlayer(turn.player, matchControl.controllers);
    if (currentController !== "cpu") {
      this.setAutomationIdle(matchControl);
      return;
    }

    if (matchControl.automation.status === "running") {
      return;
    }

    const nextMatchControl = this.withAutomationStatus(matchControl, "running");
    MatchControlRepository.set(nextMatchControl);
    const runToken = this.createAutomationRunToken();
    this.scheduleNextAutomationStep(runToken);
  }

  static getControllerForCurrentTurn(): PlayerController {
    const turn = TurnRepository.get();
    const matchControl = MatchControlRepository.get();

    return this.getControllerForPlayer(turn.player, matchControl.controllers);
  }

  static isAutomationRunning(): boolean {
    return MatchControlRepository.get().automation.status === "running";
  }

  static getAutomationStepDelayMs(): number {
    return AUTOMATION_STEP_DELAY_MS;
  }

  private static createMatchControl(
    mode: MatchMode,
    automationTurnLimit: number,
    aiStrengths: MatchAiStrengths,
  ): MatchControl {
    return {
      mode,
      controllers:
        mode === "cpu-vs-cpu"
          ? { self: "cpu", opponent: "cpu" }
          : { self: "human", opponent: "cpu" },
      aiStrengths: this.normalizeAiStrengths(mode, aiStrengths),
      automation: {
        status: "idle",
        automatedTurns: 0,
        turnLimit: automationTurnLimit,
        stopReason: null,
        stoppedAtWinner: null,
      },
    };
  }

  private static getControllerForPlayer(
    player: Player,
    controllers: MatchControllers,
  ): PlayerController {
    return player === Player.SELF ? controllers.self : controllers.opponent;
  }

  private static getAiStrengthForPlayer(player: Player, aiStrengths: MatchAiStrengths): AiStrength {
    return player === Player.SELF ? aiStrengths.self : aiStrengths.opponent;
  }

  private static normalizeAiStrengths(
    mode: MatchMode,
    aiStrengths: MatchAiStrengths,
  ): MatchAiStrengths {
    return {
      self: mode === "cpu-vs-cpu" ? aiStrengths.self : AiStrength.STRENGTH_1,
      opponent: aiStrengths.opponent,
    };
  }

  private static incrementAutomatedTurns(matchControl: MatchControl): MatchControl {
    return {
      ...matchControl,
      automation: {
        ...matchControl.automation,
        automatedTurns: matchControl.automation.automatedTurns + 1,
      },
    };
  }

  private static scheduleNextAutomationStep(runToken: number): void {
    setTimeout(() => {
      this.executeAutomationStep(runToken);
    }, AUTOMATION_STEP_DELAY_MS);
  }

  private static executeAutomationStep(runToken: number): void {
    if (runToken !== this.automationRunToken) {
      return;
    }

    let matchControl = MatchControlRepository.get();
    const currentTurn = TurnRepository.get();

    if (currentTurn.winner) {
      this.setAutomationStopped(matchControl, "winner", currentTurn.winner);
      return;
    }

    const currentPlayerController = this.getControllerForPlayer(
      currentTurn.player,
      matchControl.controllers,
    );
    if (currentPlayerController !== "cpu") {
      this.setAutomationIdle(matchControl);
      return;
    }

    if (matchControl.automation.automatedTurns >= matchControl.automation.turnLimit) {
      this.setAutomationStopped(matchControl, "turn-limit", null);
      return;
    }

    const currentAiStrength = this.getAiStrengthForPlayer(
      currentTurn.player,
      matchControl.aiStrengths,
    );
    AiService.doAiTurn(currentTurn.player, currentAiStrength);
    const postTurn = TurnRepository.get();

    if (postTurn.num > currentTurn.num) {
      matchControl = this.incrementAutomatedTurns(matchControl);
    }

    MatchControlRepository.set(matchControl);

    if (postTurn.winner) {
      this.setAutomationStopped(matchControl, "winner", postTurn.winner);
      return;
    }

    const nextPlayerController = this.getControllerForPlayer(
      postTurn.player,
      matchControl.controllers,
    );
    if (nextPlayerController !== "cpu") {
      this.setAutomationIdle(matchControl);
      return;
    }

    this.scheduleNextAutomationStep(runToken);
  }

  private static createAutomationRunToken(): number {
    this.automationRunToken += 1;
    return this.automationRunToken;
  }

  private static cancelScheduledAutomation(): void {
    this.automationRunToken += 1;
  }

  private static withAutomationStatus(
    matchControl: MatchControl,
    status: MatchAutomationState["status"],
  ): MatchControl {
    return {
      ...matchControl,
      automation: {
        ...matchControl.automation,
        status,
      },
    };
  }

  private static setAutomationIdle(matchControl: MatchControl): void {
    this.cancelScheduledAutomation();
    MatchControlRepository.set({
      ...matchControl,
      automation: {
        ...matchControl.automation,
        status: "idle",
        stopReason: null,
        stoppedAtWinner: null,
      },
    });
  }

  private static setAutomationStopped(
    matchControl: MatchControl,
    stopReason: MatchAutomationState["stopReason"],
    winner: Player | null,
  ): void {
    this.cancelScheduledAutomation();
    MatchControlRepository.set({
      ...matchControl,
      automation: {
        ...matchControl.automation,
        status: "stopped",
        stopReason,
        stoppedAtWinner: winner,
      },
    });
  }
}

export { DEFAULT_AUTOMATION_TURN_LIMIT };
