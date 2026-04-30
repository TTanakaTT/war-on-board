<script lang="ts">
  import { AiStrength } from "$lib/domain/enums/AiStrength";
  import {
    DEFAULT_AUTOMATION_TURN_LIMIT,
    DEFAULT_GAME_LAYER,
  } from "$lib/domain/constants/GameConstants";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import type { MatchMode } from "$lib/domain/types/match";
  import { locales, setLocale } from "$lib/paraglide/runtime";
  import { m } from "$lib/paraglide/messages";
  import { MatchService } from "$lib/services/MatchService";
  let {
    dialog = $bindable(),
    open,
    isNav,
    onClickDialog,
  }: {
    dialog?: HTMLDialogElement;
    open: boolean;
    isNav: boolean;
    onClickDialog: (event: MouseEvent) => void;
  } = $props();
  let navTranslateStyle = $derived(open ? "translate-x-0" : "-translate-x-full");
  let matchControl = $derived(MatchControlRepository.get());
  let selectedMode = $state<MatchMode>("human-vs-cpu");
  let selectedOpponentAiStrength = $state<AiStrength>(AiStrength.STRENGTH_1);
  let selectedCpuOneAiStrength = $state<AiStrength>(AiStrength.STRENGTH_1);
  let selectedCpuTwoAiStrength = $state<AiStrength>(AiStrength.STRENGTH_1);
  const aiStrengthOptions = [AiStrength.STRENGTH_1, AiStrength.STRENGTH_2];

  $effect(() => {
    selectedMode = matchControl.mode;
    selectedOpponentAiStrength = matchControl.aiStrengths.opponent;
    selectedCpuOneAiStrength = matchControl.aiStrengths.self;
    selectedCpuTwoAiStrength = matchControl.aiStrengths.opponent;
  });

  function aiStrengthLabel(aiStrength: AiStrength): string {
    if (aiStrength === AiStrength.STRENGTH_2) {
      return m.ai_strength_level_2();
    }

    return m.ai_strength_level_1();
  }

  function modeButtonClass(mode: MatchMode): string {
    return `rounded-xl border px-3 py-2 text-left transition ${
      selectedMode === mode
        ? "border-primary bg-primary-variant text-onbackground dark:border-primary-dark dark:bg-primary-variant-dark dark:text-onbackground-dark"
        : "border-outline dark:border-outline-dark"
    }`;
  }

  function aiStrengthButtonClass(isSelected: boolean): string {
    return `rounded-xl border px-3 py-2 text-left text-sm transition ${
      isSelected
        ? "border-primary bg-primary-variant text-onbackground dark:border-primary-dark dark:bg-primary-variant-dark dark:text-onbackground-dark"
        : "border-outline dark:border-outline-dark"
    }`;
  }

  function startMatch() {
    MatchService.startMatch(selectedMode, {
      layer: DEFAULT_GAME_LAYER,
      automationTurnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
      aiStrengths:
        selectedMode === "cpu-vs-cpu"
          ? {
              self: selectedCpuOneAiStrength,
              opponent: selectedCpuTwoAiStrength,
            }
          : {
              self: AiStrength.STRENGTH_1,
              opponent: selectedOpponentAiStrength,
            },
    });
  }
</script>

{#if isNav}
  <nav
    class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark text-onsurface dark:text-onsurface-dark fixed z-1000 h-screen w-64 overflow-hidden border transition duration-200 ease-out {navTranslateStyle}"
  >
    <div class="flex h-full flex-col gap-6 p-4">
      <div>
        <h1 class="text-xl font-semibold">{m.drawer_title()}</h1>
      </div>

      <section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold tracking-wide uppercase">{m.match_mode_title()}</h2>
        <button
          type="button"
          class={modeButtonClass("human-vs-cpu")}
          onclick={() => (selectedMode = "human-vs-cpu")}
        >
          {m.match_mode_human_vs_cpu()}
        </button>
        <button
          type="button"
          class={modeButtonClass("cpu-vs-cpu")}
          onclick={() => (selectedMode = "cpu-vs-cpu")}
        >
          {m.match_mode_cpu_vs_cpu()}
        </button>
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold tracking-wide uppercase">{m.ai_strength_title()}</h2>
        {#if selectedMode === "cpu-vs-cpu"}
          <div class="flex flex-col gap-2">
            <p class="text-xs font-medium">{m.cpu_one()}</p>
            <div class="grid grid-cols-3 gap-2">
              {#each aiStrengthOptions as aiStrength (aiStrength)}
                <button
                  type="button"
                  class={aiStrengthButtonClass(selectedCpuOneAiStrength === aiStrength)}
                  onclick={() => (selectedCpuOneAiStrength = aiStrength)}
                >
                  {aiStrengthLabel(aiStrength)}
                </button>
              {/each}
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <p class="text-xs font-medium">{m.cpu_two()}</p>
            <div class="grid grid-cols-3 gap-2">
              {#each aiStrengthOptions as aiStrength (aiStrength)}
                <button
                  type="button"
                  class={aiStrengthButtonClass(selectedCpuTwoAiStrength === aiStrength)}
                  onclick={() => (selectedCpuTwoAiStrength = aiStrength)}
                >
                  {aiStrengthLabel(aiStrength)}
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="flex flex-col gap-2">
            <p class="text-xs font-medium">{m.ai_strength_opponent_cpu()}</p>
            <div class="grid grid-cols-3 gap-2">
              {#each aiStrengthOptions as aiStrength (aiStrength)}
                <button
                  type="button"
                  class={aiStrengthButtonClass(selectedOpponentAiStrength === aiStrength)}
                  onclick={() => (selectedOpponentAiStrength = aiStrength)}
                >
                  {aiStrengthLabel(aiStrength)}
                </button>
              {/each}
            </div>
          </div>
        {/if}
        <button
          type="button"
          class="border-primary bg-primary text-onbackground dark:border-primary-dark dark:bg-primary-dark dark:text-onbackground-dark rounded-xl border px-3 py-2 font-semibold transition"
          onclick={startMatch}
        >
          {m.start_match()}
        </button>
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold tracking-wide uppercase">{m.language_title()}</h2>
        <div class="flex flex-wrap gap-2">
          {#each locales as locale (locale)}
            <button
              type="button"
              class="border-primary dark:border-primary-dark hover:ring-primary dark:hover:ring-primary-dark m-1 rounded-xl border p-1 hover:ring"
              onclick={() => setLocale(locale)}>{locale}</button
            >
          {/each}
        </div>
      </section>
    </div>
  </nav>
{:else}
  <dialog bind:this={dialog} onclick={onClickDialog}>
    <div
      class="dialog-content bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark border-outline dark:border-outline-dark fixed h-screen w-64 overflow-hidden border transition duration-200 ease-out {navTranslateStyle}"
    >
      <div class="flex h-full flex-col gap-6 p-4">
        <div>
          <h1 class="text-xl font-semibold">{m.drawer_title()}</h1>
        </div>

        <section class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold tracking-wide uppercase">{m.match_mode_title()}</h2>
          <button
            type="button"
            class={modeButtonClass("human-vs-cpu")}
            onclick={() => (selectedMode = "human-vs-cpu")}
          >
            {m.match_mode_human_vs_cpu()}
          </button>
          <button
            type="button"
            class={modeButtonClass("cpu-vs-cpu")}
            onclick={() => (selectedMode = "cpu-vs-cpu")}
          >
            {m.match_mode_cpu_vs_cpu()}
          </button>
        </section>

        <section class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold tracking-wide uppercase">{m.ai_strength_title()}</h2>
          {#if selectedMode === "cpu-vs-cpu"}
            <div class="flex flex-col gap-2">
              <p class="text-xs font-medium">{m.cpu_one()}</p>
              <div class="grid grid-cols-3 gap-2">
                {#each aiStrengthOptions as aiStrength (aiStrength)}
                  <button
                    type="button"
                    class={aiStrengthButtonClass(selectedCpuOneAiStrength === aiStrength)}
                    onclick={() => (selectedCpuOneAiStrength = aiStrength)}
                  >
                    {aiStrengthLabel(aiStrength)}
                  </button>
                {/each}
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <p class="text-xs font-medium">{m.cpu_two()}</p>
              <div class="grid grid-cols-3 gap-2">
                {#each aiStrengthOptions as aiStrength (aiStrength)}
                  <button
                    type="button"
                    class={aiStrengthButtonClass(selectedCpuTwoAiStrength === aiStrength)}
                    onclick={() => (selectedCpuTwoAiStrength = aiStrength)}
                  >
                    {aiStrengthLabel(aiStrength)}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <div class="flex flex-col gap-2">
              <p class="text-xs font-medium">{m.ai_strength_opponent_cpu()}</p>
              <div class="grid grid-cols-3 gap-2">
                {#each aiStrengthOptions as aiStrength (aiStrength)}
                  <button
                    type="button"
                    class={aiStrengthButtonClass(selectedOpponentAiStrength === aiStrength)}
                    onclick={() => (selectedOpponentAiStrength = aiStrength)}
                  >
                    {aiStrengthLabel(aiStrength)}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          <button
            type="button"
            class="border-primary bg-primary text-onbackground dark:border-primary-dark dark:bg-primary-dark dark:text-onbackground-dark rounded-xl border px-3 py-2 font-semibold transition"
            onclick={startMatch}
          >
            {m.start_match()}
          </button>
        </section>

        <section class="flex flex-col gap-3">
          <h2 class="text-sm font-semibold tracking-wide uppercase">{m.language_title()}</h2>
          <div class="flex flex-wrap gap-2">
            {#each locales as locale (locale)}
              <button
                type="button"
                class="border-primary dark:border-primary-dark hover:ring-primary dark:hover:ring-primary-dark m-1 rounded-xl border p-1 hover:ring"
                onclick={() => setLocale(locale)}>{locale}</button
              >
            {/each}
          </div>
        </section>
      </div>
    </div>
  </dialog>
{/if}
