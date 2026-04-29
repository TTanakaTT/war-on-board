<script lang="ts">
  import {
    DEFAULT_AUTOMATION_TURN_LIMIT,
    DEFAULT_GAME_LAYER,
  } from "$lib/domain/constants/GameConstants";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
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

  function startMatch(mode: "human-vs-cpu" | "cpu-vs-cpu") {
    MatchService.startMatch(mode, {
      layer: DEFAULT_GAME_LAYER,
      automationTurnLimit: DEFAULT_AUTOMATION_TURN_LIMIT,
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
          class="rounded-xl border px-3 py-2 text-left transition {matchControl.mode ===
          'human-vs-cpu'
            ? 'border-primary bg-primary-variant text-onbackground dark:border-primary-dark dark:bg-primary-variant-dark dark:text-onbackground-dark'
            : 'border-outline dark:border-outline-dark'}"
          onclick={() => startMatch("human-vs-cpu")}
        >
          {m.match_mode_human_vs_cpu()}
        </button>
        <button
          type="button"
          class="rounded-xl border px-3 py-2 text-left transition {matchControl.mode ===
          'cpu-vs-cpu'
            ? 'border-primary bg-primary-variant text-onbackground dark:border-primary-dark dark:bg-primary-variant-dark dark:text-onbackground-dark'
            : 'border-outline dark:border-outline-dark'}"
          onclick={() => startMatch("cpu-vs-cpu")}
        >
          {m.match_mode_cpu_vs_cpu()}
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
            class="rounded-xl border px-3 py-2 text-left transition {matchControl.mode ===
            'human-vs-cpu'
              ? 'border-primary bg-primary-variant text-onbackground dark:border-primary-dark dark:bg-primary-variant-dark dark:text-onbackground-dark'
              : 'border-outline dark:border-outline-dark'}"
            onclick={() => startMatch("human-vs-cpu")}
          >
            {m.match_mode_human_vs_cpu()}
          </button>
          <button
            type="button"
            class="rounded-xl border px-3 py-2 text-left transition {matchControl.mode ===
            'cpu-vs-cpu'
              ? 'border-primary bg-primary-variant text-onbackground dark:border-primary-dark dark:bg-primary-variant-dark dark:text-onbackground-dark'
              : 'border-outline dark:border-outline-dark'}"
            onclick={() => startMatch("cpu-vs-cpu")}
          >
            {m.match_mode_cpu_vs_cpu()}
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
