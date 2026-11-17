import { GameApiClient } from "#lib/api/GameApiClient.ts";
import { MatchControlRepository } from "#lib/data/repositories/MatchControlRepository.ts";
import { TurnRepository } from "#lib/data/repositories/TurnRepository.ts";
import { DEFAULT_AUTOMATION_TURN_LIMIT } from "#lib/domain/constants/GameConstants.ts";
import { AiStrength } from "#lib/domain/enums/AiStrength.ts";
import { Player } from "#lib/domain/enums/Player.ts";
import type {
  MatchAiSeeds,
  MatchAutomationState,
  MatchAiStrengths,
  MatchControl,
  MatchControllers,
  MatchMode,
  PlayerController,
  StartMatchOptions,
} from "#lib/domain/types/match.ts";
import { AiService } from "#lib/services/AiService.ts";
import {
  createRandomSeed,
  createSeededRandom,
  type RandomSource,
} from "#lib/services/ai/random.ts";
import { GameDialogService } from "#lib/services/GameDialogService.ts";

const AUTOMATION_STEP_DELAY_MS = 120;

export class MatchService {
  private static automationRunToken = 0;
  /** Each player's CPU random source, rebuilt from MatchControl.aiSeeds on every match start. */
  private static aiRandomSources: Partial<Record<string, RandomSource>> = {};

  static startMatch(options: StartMatchOptions): void {
    this.cancelScheduledAutomation();
    GameDialogService.reset();
    GameApiClient.initializeGame({ layer: options.layer });
    const matchControl = this.createMatchControl(options);
    MatchControlRepository.set(matchControl);
    this.aiRandomSources = {
      [String(Player.SELF)]: createSeededRandom(matchControl.aiSeeds.self),
      [String(Player.OPPONENT)]: createSeededRandom(matchControl.aiSeeds.opponent),
    };
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

  /**
   * Stops scheduled CPU automation without a stop reason, so no result dialog opens
   * and the board stays as it is for inspection.
   */
  static haltAutomation(): void {
    this.setAutomationIdle(MatchControlRepository.get());
  }

  private static createMatchControl(options: StartMatchOptions): MatchControl {
    const mode = this.createMatchMode(options.controllers);

    return {
      mode,
      controllers: {
        self: options.controllers.self,
        opponent: options.controllers.opponent,
      },
      aiStrengths: this.normalizeAiStrengths(options.controllers, options.aiStrengths),
      aiSeeds: options.aiSeeds
        ? { ...options.aiSeeds }
        : { self: createRandomSeed(), opponent: createRandomSeed() },
      automation: {
        status: "idle",
        automatedTurns: 0,
        turnLimit: options.automationTurnLimit,
        stopReason: null,
        stoppedAtWinner: null,
      },
    };
  }

  private static createMatchMode(controllers: MatchControllers): MatchMode {
    if (controllers.self === "human" && controllers.opponent === "human") {
      return "human-vs-human";
    }

    if (controllers.self === "human" && controllers.opponent === "cpu") {
      return "human-vs-cpu";
    }

    if (controllers.self === "cpu" && controllers.opponent === "human") {
      return "cpu-vs-human";
    }

    return "cpu-vs-cpu";
  }

  private static getControllerForPlayer(
    player: Player,
    controllers: MatchControllers,
  ): PlayerController {
    return player === Player.SELF ? controllers.self : controllers.opponent;
  }

  /** Falls back to the stored seed when the match did not go through startMatch. */
  private static getAiRandomSource(player: Player, aiSeeds: MatchAiSeeds): RandomSource {
    const key = String(player);
    const existing = this.aiRandomSources[key];
    if (existing) {
      return existing;
    }

    const created = createSeededRandom(player === Player.SELF ? aiSeeds.self : aiSeeds.opponent);
    this.aiRandomSources[key] = created;
    return created;
  }

  private static getAiStrengthForPlayer(player: Player, aiStrengths: MatchAiStrengths): AiStrength {
    return player === Player.SELF ? aiStrengths.self : aiStrengths.opponent;
  }

  private static normalizeAiStrengths(
    controllers: MatchControllers,
    aiStrengths: MatchAiStrengths,
  ): MatchAiStrengths {
    return {
      self: controllers.self === "cpu" ? aiStrengths.self : AiStrength.STRENGTH_1,
      opponent: controllers.opponent === "cpu" ? aiStrengths.opponent : AiStrength.STRENGTH_1,
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
    AiService.doAiTurn(
      currentTurn.player,
      currentAiStrength,
      this.getAiRandomSource(currentTurn.player, matchControl.aiSeeds),
    );
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
