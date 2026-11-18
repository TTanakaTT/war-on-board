import { GameApiClient } from "#lib/api/GameApiClient.ts";
import { AiStrength, Player, type Turn } from "#lib/domain/model.ts";
import type {
  AutomationStopReason,
  BySide,
  MatchControl,
  PlayerController,
  StartMatchOptions,
} from "#lib/domain/types.ts";
import { GameDialogRepository, MatchControlRepository, TurnRepository } from "#lib/store.svelte.ts";
import { AiService } from "#lib/services/AiService.ts";
import {
  createRandomSeed,
  createSeededRandom,
  type RandomSource,
} from "#lib/services/ai/random.ts";

const AUTOMATION_STEP_DELAY_MS = 120;

const sideOf = (player: Player) => (player === Player.SELF ? "self" : "opponent");

/** Match setup and CPU turn automation (one step per AUTOMATION_STEP_DELAY_MS). */
export class MatchService {
  private static automationRunToken = 0;
  private static aiRandomSources: Partial<Record<string, RandomSource>> = {};

  static startMatch(options: StartMatchOptions): void {
    this.automationRunToken += 1;
    GameDialogRepository.reset();
    GameApiClient.initializeGame({ layer: options.layer });
    const { controllers } = options;
    const aiSeeds = options.aiSeeds
      ? { ...options.aiSeeds }
      : { self: createRandomSeed(), opponent: createRandomSeed() };
    MatchControlRepository.set({
      controllers: { ...controllers },
      aiStrengths: {
        self: controllers.self === "cpu" ? options.aiStrengths.self : AiStrength.STRENGTH_1,
        opponent:
          controllers.opponent === "cpu" ? options.aiStrengths.opponent : AiStrength.STRENGTH_1,
      },
      aiSeeds,
      automation: {
        status: "idle",
        automatedTurns: 0,
        turnLimit: options.automationTurnLimit,
        stopReason: null,
        stoppedAtWinner: null,
      },
    });
    this.aiRandomSources = {
      self: createSeededRandom(aiSeeds.self),
      opponent: createSeededRandom(aiSeeds.opponent),
    };
    this.runAutomatedTurnsIfNeeded();
  }

  static runAutomatedTurnsIfNeeded(): void {
    const matchControl = MatchControlRepository.get();
    const turn = TurnRepository.get();
    if (turn.winner) return this.stop("winner", turn.winner);
    if (this.controllerOf(turn.player) !== "cpu") return this.haltAutomation();
    if (matchControl.automation.status === "running") return;

    this.setAutomation({ status: "running" });
    this.automationRunToken += 1;
    this.scheduleStep(this.automationRunToken);
  }

  static getControllerForCurrentTurn(): PlayerController {
    return this.controllerOf(TurnRepository.get().player);
  }

  static isAutomationRunning(): boolean {
    return MatchControlRepository.get().automation.status === "running";
  }

  static getAutomationStepDelayMs(): number {
    return AUTOMATION_STEP_DELAY_MS;
  }

  /** Stops automation without a stop reason: no result dialog, board left for inspection. */
  static haltAutomation(): void {
    this.automationRunToken += 1;
    this.setAutomation({ status: "idle", stopReason: null, stoppedAtWinner: null });
  }

  private static controllerOf(player: Player): PlayerController {
    return MatchControlRepository.get().controllers[sideOf(player)];
  }

  private static scheduleStep(runToken: number): void {
    setTimeout(() => this.executeAutomationStep(runToken), AUTOMATION_STEP_DELAY_MS);
  }

  private static executeAutomationStep(runToken: number): void {
    if (runToken !== this.automationRunToken) return;
    const { aiStrengths, aiSeeds, automation } = MatchControlRepository.get();
    const turn = TurnRepository.get();
    if (turn.winner) return this.stop("winner", turn.winner);
    if (this.controllerOf(turn.player) !== "cpu") return this.haltAutomation();
    if (automation.automatedTurns >= automation.turnLimit) return this.stop("turn-limit", null);

    let aiFailure: { error: unknown } | null = null;
    try {
      const side = sideOf(turn.player);
      AiService.doAiTurn(turn.player, aiStrengths[side], this.randomSource(side, aiSeeds));
    } catch (error) {
      aiFailure = { error };
    }

    const after = TurnRepository.get();
    if (after.player !== turn.player || after.winner !== null) {
      this.finishTurn(runToken, turn, after);
    } else {
      // The CPU could not end its turn; halt instead of retrying forever.
      this.haltAutomation();
    }
    // Rethrown from the timer so it surfaces as an uncaught exception.
    if (aiFailure) throw aiFailure.error;
  }

  private static finishTurn(runToken: number, before: Turn, after: Turn): void {
    if (after.num > before.num) {
      const { automation } = MatchControlRepository.get();
      this.setAutomation({ automatedTurns: automation.automatedTurns + 1 });
    }
    if (after.winner) return this.stop("winner", after.winner);
    if (this.controllerOf(after.player) !== "cpu") return this.haltAutomation();
    this.scheduleStep(runToken);
  }

  /** Falls back to the stored seed when the match did not go through startMatch. */
  private static randomSource(side: "self" | "opponent", aiSeeds: BySide<number>): RandomSource {
    return (this.aiRandomSources[side] ??= createSeededRandom(aiSeeds[side]));
  }

  private static stop(stopReason: AutomationStopReason, winner: Player | null): void {
    this.automationRunToken += 1;
    this.setAutomation({ status: "stopped", stopReason, stoppedAtWinner: winner });
  }

  private static setAutomation(change: Partial<MatchControl["automation"]>): void {
    const matchControl = MatchControlRepository.get();
    MatchControlRepository.set({
      ...matchControl,
      automation: { ...matchControl.automation, ...change },
    });
  }
}
