import type { PlayerSnapshot } from "$lib/domain/types/api";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { Player } from "$lib/domain/enums/Player";
import type { MatchAiStrengths, MatchControllers, PlayerController } from "$lib/domain/types/match";
import { m } from "$lib/paraglide/messages";

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

  return aiStrengthLabel(aiStrength);
}

export function seatLabel(player: Player | PlayerSnapshot): string {
  return isSelfPlayer(player) ? m.first_player_label() : m.second_player_label();
}

export function playerDisplayName(
  player: Player | PlayerSnapshot,
  controllers: MatchControllers,
  aiStrengths: MatchAiStrengths,
): string {
  const controller = isSelfPlayer(player) ? controllers.self : controllers.opponent;
  const aiStrength = isSelfPlayer(player) ? aiStrengths.self : aiStrengths.opponent;

  return controllerSelectionLabel(controller, aiStrength);
}

export function playerSlotSummary(
  player: Player | PlayerSnapshot,
  controllers: MatchControllers,
  aiStrengths: MatchAiStrengths,
): string {
  return `${seatLabel(player)}: ${playerDisplayName(player, controllers, aiStrengths)}`;
}
