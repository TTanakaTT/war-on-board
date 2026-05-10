import { describe, expect, test } from "vitest";
import { AiStrength } from "$lib/domain/enums/AiStrength";
import { m } from "$lib/paraglide/messages";
import { playerDisplayName } from "$lib/presentation/matchPresentation";

describe("matchPresentation", () => {
  describe("playerDisplayName", () => {
    test("keeps distinct base labels unchanged", () => {
      const controllers = {
        self: "human",
        opponent: "cpu",
      } as const;
      const aiStrengths = {
        self: AiStrength.STRENGTH_1,
        opponent: AiStrength.STRENGTH_2,
      } as const;

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe(m.player_option_human());
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe(
        m.player_option_ai_strength_2(),
      );
    });

    test("adds seat-order numbers when both human labels match", () => {
      const controllers = {
        self: "human",
        opponent: "human",
      } as const;
      const aiStrengths = {
        self: AiStrength.STRENGTH_1,
        opponent: AiStrength.STRENGTH_1,
      } as const;

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe(
        m.player_option_human_numbered({ index: "1" }),
      );
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe(
        m.player_option_human_numbered({ index: "2" }),
      );
    });

    test("adds seat-order numbers when cpu labels match", () => {
      const controllers = {
        self: "cpu",
        opponent: "cpu",
      } as const;
      const aiStrengths = {
        self: AiStrength.STRENGTH_2,
        opponent: AiStrength.STRENGTH_2,
      } as const;

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe(
        m.player_option_ai_strength_numbered({
          index: "1",
          level: m.ai_strength_level_2(),
        }),
      );
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe(
        m.player_option_ai_strength_numbered({
          index: "2",
          level: m.ai_strength_level_2(),
        }),
      );
    });

    test("keeps cpu labels unchanged when strengths differ", () => {
      const controllers = {
        self: "cpu",
        opponent: "cpu",
      } as const;
      const aiStrengths = {
        self: AiStrength.STRENGTH_1,
        opponent: AiStrength.STRENGTH_3,
      } as const;

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe(
        m.player_option_ai_strength_1(),
      );
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe(
        m.player_option_ai_strength_3(),
      );
    });
  });
});
