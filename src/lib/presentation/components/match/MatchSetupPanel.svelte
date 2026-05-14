<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import {
    DEFAULT_AUTOMATION_TURN_LIMIT,
    DEFAULT_GAME_LAYER,
  } from "$lib/domain/constants/GameConstants";
  import { AiStrength } from "$lib/domain/enums/AiStrength";
  import type { MatchControllers } from "$lib/domain/types/match";
  import { m } from "$lib/paraglide/messages";
  import AppButton from "$lib/presentation/components/primitives/AppButton.svelte";
  import HorizontalRadioGroup from "$lib/presentation/components/primitives/HorizontalRadioGroup.svelte";
  import { MatchService } from "$lib/services/MatchService";

  type MatchSetupSelection = "human" | "ai-1" | "ai-2" | "ai-3";

  interface AiSelectionDefinition {
    value: Exclude<MatchSetupSelection, "human">;
    label: () => string;
    strength: AiStrength;
  }

  const AI_SELECTIONS: AiSelectionDefinition[] = [
    {
      value: "ai-1",
      label: () => m.player_option_ai_strength_1(),
      strength: AiStrength.STRENGTH_1,
    },
    {
      value: "ai-2",
      label: () => m.player_option_ai_strength_2(),
      strength: AiStrength.STRENGTH_2,
    },
    {
      value: "ai-3",
      label: () => m.player_option_ai_strength_3(),
      strength: AiStrength.STRENGTH_3,
    },
  ];
  const DEFAULT_AI_SELECTION = AI_SELECTIONS[0].value;

  let selfSelection = $state<MatchSetupSelection>("human");
  let opponentSelection = $state<MatchSetupSelection>(DEFAULT_AI_SELECTION);
  let selectedLayer = $state<number>(DEFAULT_GAME_LAYER);

  function selectionOptions(): { value: MatchSetupSelection; label: string }[] {
    return [
      {
        value: "human",
        label: m.player_option_human(),
      },
      ...AI_SELECTIONS.map((selection) => ({
        value: selection.value,
        label: selection.label(),
      })),
    ];
  }

  function clampLayer(layer: number): number {
    if (!Number.isFinite(layer)) {
      return DEFAULT_GAME_LAYER;
    }

    return Math.max(2, Math.floor(layer));
  }

  function controllerFor(selection: MatchSetupSelection): MatchControllers["self"] {
    return selection === "human" ? "human" : "cpu";
  }

  function aiStrengthFor(selection: MatchSetupSelection): AiStrength {
    return (
      AI_SELECTIONS.find((aiSelection) => aiSelection.value === selection)?.strength ??
      AI_SELECTIONS[0].strength
    );
  }

  function withDefaultAiIfNeeded(selection: MatchSetupSelection): MatchSetupSelection {
    return selection === "human" ? DEFAULT_AI_SELECTION : selection;
  }

  function applyPreset(preset: "vs-ai" | "ai-vs-ai"): void {
    if (preset === "vs-ai") {
      selfSelection = "human";
      opponentSelection = withDefaultAiIfNeeded(opponentSelection);
      return;
    }

    selfSelection = withDefaultAiIfNeeded(selfSelection);
    opponentSelection = withDefaultAiIfNeeded(opponentSelection);
  }

  async function startMatch(): Promise<void> {
    const nextLayer = clampLayer(selectedLayer);
    selectedLayer = nextLayer;

    MatchService.startMatch({
      controllers: {
        self: controllerFor(selfSelection),
        opponent: controllerFor(opponentSelection),
      },
      layer: nextLayer,
      automationTurnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
      aiStrengths: {
        self: aiStrengthFor(selfSelection),
        opponent: aiStrengthFor(opponentSelection),
      },
    });

    await goto(resolve("/game"));
  }
</script>

<div class="flex min-h-full items-start justify-center px-4 py-6 sm:px-6 sm:py-10">
  <div class="mx-auto flex max-w-fit flex-col items-center space-y-8">
    <section class="space-y-3">
      <div class="flex flex-wrap justify-center gap-3">
        <AppButton onclick={() => applyPreset("vs-ai")}>
          {m.preset_vs_ai()}
        </AppButton>
        <AppButton onclick={() => applyPreset("ai-vs-ai")}>
          {m.preset_ai_vs_ai()}
        </AppButton>
      </div>

      <div class="grid gap-5 lg:grid-cols-2 lg:items-start lg:justify-center">
        <div class="space-y-3">
          <h2 class="text-center font-semibold tracking-wide uppercase">
            {m.first_player_label()}
          </h2>
          <HorizontalRadioGroup
            name="match-setup-first-player"
            ariaLabel={m.first_player_label()}
            options={selectionOptions()}
            value={selfSelection}
            onChange={(value) => (selfSelection = value as MatchSetupSelection)}
          />
        </div>

        <div class="space-y-3">
          <h2 class="text-center font-semibold tracking-wide uppercase">
            {m.second_player_label()}
          </h2>
          <HorizontalRadioGroup
            name="match-setup-second-player"
            ariaLabel={m.second_player_label()}
            options={selectionOptions()}
            value={opponentSelection}
            onChange={(value) => (opponentSelection = value as MatchSetupSelection)}
          />
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-center font-semibold tracking-wide uppercase">
        {m.layer_count_label()}
      </h2>
      <input
        class="border-outline dark:border-outline-dark bg-surface dark:bg-surface-dark h-10 w-28 rounded-2xl border px-3 text-center text-base font-semibold"
        type="number"
        min="2"
        bind:value={selectedLayer}
        onblur={() => (selectedLayer = clampLayer(selectedLayer))}
      />
    </section>

    <AppButton additionalClass="px-6" onclick={startMatch}>
      {m.start_match()}
    </AppButton>
  </div>
</div>
