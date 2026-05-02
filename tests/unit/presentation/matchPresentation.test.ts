import { describe, expect, test } from "vitest";
import { AiStrength } from "$lib/domain/enums/AiStrength";
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

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe("Player");
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe("AI Lv.2");
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

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe("Player 1");
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe("Player 2");
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

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe("AI 1 Lv.2");
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe("AI 2 Lv.2");
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

      expect(playerDisplayName("self", controllers, aiStrengths)).toBe("AI Lv.1");
      expect(playerDisplayName("opponent", controllers, aiStrengths)).toBe("AI Lv.3");
    });
  });
});
