import type { PlayerSnapshot } from "$lib/domain/types/api";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { Player } from "$lib/domain/enums/Player";
import type { MatchAiStrengths, MatchControllers, PlayerController } from "$lib/domain/types/match";
import { m } from "$lib/paraglide/messages";

type ControllablePlayerId = keyof MatchControllers;

function isSelfPlayer(player: Player | PlayerSnapshot): boolean {
  return player === Player.SELF || player === "self";
}

export function aiStrengthLabel(aiStrength: AiStrength): string {
  if (aiStrength === AiStrength.STRENGTH_1) {
    return m.ai_strength_level_1();
  }

  if (aiStrength === AiStrength.STRENGTH_2) {
    return m.ai_strength_level_2();
  }

  return m.ai_strength_level_3();
}

export function controllerSelectionLabel(
  controller: PlayerController,
  aiStrength: AiStrength,
): string {
  if (controller === "human") {
    return m.player_option_human();
  }

  if (aiStrength === AiStrength.STRENGTH_1) {
    return m.player_option_ai_strength_1();
  }

  if (aiStrength === AiStrength.STRENGTH_2) {
    return m.player_option_ai_strength_2();
  }

  return m.player_option_ai_strength_3();
}

function playerBaseName(controller: PlayerController, aiStrength: AiStrength): string {
  return controllerSelectionLabel(controller, aiStrength);
}

function playerNumberedName(
  controller: PlayerController,
  aiStrength: AiStrength,
  seatNumber: number,
): string {
  if (controller === "human") {
    return m.player_option_human_numbered({ index: String(seatNumber) });
  }

  return m.player_option_ai_strength_numbered({
    index: String(seatNumber),
    level: aiStrengthLabel(aiStrength),
  });
}

export function playerDisplayNames(
  controllers: MatchControllers,
  aiStrengths: MatchAiStrengths,
): Record<ControllablePlayerId, string> {
  const selfBaseName = playerBaseName(controllers.self, aiStrengths.self);
  const opponentBaseName = playerBaseName(controllers.opponent, aiStrengths.opponent);

  if (selfBaseName !== opponentBaseName) {
    return {
      self: selfBaseName,
      opponent: opponentBaseName,
    };
  }

  return {
    self: playerNumberedName(controllers.self, aiStrengths.self, 1),
    opponent: playerNumberedName(controllers.opponent, aiStrengths.opponent, 2),
  };
}

export function playerInfoOrder(isWideLayout: boolean): [Player, Player] {
  return isWideLayout ? [Player.SELF, Player.OPPONENT] : [Player.OPPONENT, Player.SELF];
}

export function seatLabel(player: Player | PlayerSnapshot): string {
  return isSelfPlayer(player) ? m.first_player_label() : m.second_player_label();
}

export function playerDisplayName(
  player: Player | PlayerSnapshot,
  controllers: MatchControllers,
  aiStrengths: MatchAiStrengths,
): string {
  const displayNames = playerDisplayNames(controllers, aiStrengths);
  return isSelfPlayer(player) ? displayNames.self : displayNames.opponent;
}

export function playerSlotSummary(
  player: Player | PlayerSnapshot,
  controllers: MatchControllers,
  aiStrengths: MatchAiStrengths,
): string {
  return `${seatLabel(player)}: ${playerDisplayName(player, controllers, aiStrengths)}`;
}
