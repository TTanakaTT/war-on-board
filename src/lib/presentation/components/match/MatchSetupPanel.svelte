<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { DEFAULT_AUTOMATION_TURN_LIMIT, DEFAULT_GAME_MAP } from "#lib/domain/config.ts";
  import { AiStrength, GAME_MAP_IDS, type GameMapId } from "#lib/domain/model.ts";
  import type { BySide, PlayerController } from "#lib/domain/types.ts";
  import { m } from "#lib/paraglide/messages.js";
  import AppButton from "#lib/presentation/components/primitives/AppButton.svelte";
  import HorizontalRadioGroup from "#lib/presentation/components/primitives/HorizontalRadioGroup.svelte";
  import { mapLabel } from "#lib/presentation/labels.ts";
  import MapPreview from "./MapPreview.svelte";
  import TerrainLegend from "./TerrainLegend.svelte";
  import { MatchService } from "#lib/services/MatchService.ts";

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
  let selectedMap = $state<GameMapId>(DEFAULT_GAME_MAP);

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

  function controllerFor(selection: MatchSetupSelection): BySide<PlayerController>["self"] {
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
    MatchService.startMatch({
      controllers: {
        self: controllerFor(selfSelection),
        opponent: controllerFor(opponentSelection),
      },
      map: selectedMap,
      automationTurnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
      aiStrengths: {
        self: aiStrengthFor(selfSelection),
        opponent: aiStrengthFor(opponentSelection),
      },
    });

    await goto(resolve("game"));
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

    <section class="flex flex-col items-center space-y-3">
      <h2 class="text-center font-semibold tracking-wide uppercase">
        {m.map_label()}
      </h2>
      <HorizontalRadioGroup
        name="match-setup-map"
        ariaLabel={m.map_label()}
        options={GAME_MAP_IDS.map((map) => ({ value: map, label: mapLabel(map) }))}
        value={selectedMap}
        onChange={(value) => (selectedMap = value as GameMapId)}
      />
      <MapPreview map={selectedMap} />
      <div class="max-w-sm">
        <TerrainLegend />
      </div>
    </section>

    <AppButton additionalClass="px-6" onclick={startMatch}>
      {m.start_match()}
    </AppButton>
  </div>
</div>
