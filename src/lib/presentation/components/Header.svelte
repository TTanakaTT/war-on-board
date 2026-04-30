<script lang="ts">
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { AiStrength } from "$lib/domain/enums/AiStrength";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import { m } from "$lib/paraglide/messages";
  let {
    open,
    isNav,
    onClickMenu,
  }: {
    open: boolean;
    isNav: boolean;
    onClickMenu: () => void;
  } = $props();
  let headerWidthStyle = $derived.by(() => {
    if (isNav) {
      return open ? "ml-64 w-[calc(100%-(var(--spacing)*64))]" : "w-screen";
    } else {
      return "w-screen";
    }
  });
  let matchControl = $derived(MatchControlRepository.get());
  const aiStrengthLabels: Record<AiStrength, () => string> = {
    [AiStrength.STRENGTH_1]: () => m.ai_strength_level_1(),
    [AiStrength.STRENGTH_2]: () => m.ai_strength_level_2(),
    [AiStrength.STRENGTH_3]: () => m.ai_strength_level_3(),
  };

  function aiStrengthLabel(aiStrength: AiStrength): string {
    return aiStrengthLabels[aiStrength]();
  }
</script>

<header
  class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed inset-s-0 top-0 z-20 border-b shadow-md {headerWidthStyle}"
>
  <div class="flex flex-wrap items-center justify-between p-4">
    <button
      type="button"
      class="text-onsurface dark:text-onsurface-dark hover:bg-outline dark:hover:bg-outline-dark inline-flex h-8 w-8 items-center justify-center rounded-lg p-1"
      onclick={onClickMenu}
    >
      <Icon icon="menu" size={24} />
    </button>

    <div
      class="text-onsurface dark:text-onsurface-dark flex flex-wrap items-center justify-end gap-2 text-sm"
    >
      {#if matchControl.mode === "cpu-vs-cpu"}
        <span class="border-outline dark:border-outline-dark rounded-full border px-3 py-1">
          {m.cpu_one()}: {aiStrengthLabel(matchControl.aiStrengths.self)}
        </span>
        <span class="border-outline dark:border-outline-dark rounded-full border px-3 py-1">
          {m.cpu_two()}: {aiStrengthLabel(matchControl.aiStrengths.opponent)}
        </span>
      {:else}
        <span class="border-outline dark:border-outline-dark rounded-full border px-3 py-1">
          {m.ai_strength_opponent_cpu()}: {aiStrengthLabel(matchControl.aiStrengths.opponent)}
        </span>
      {/if}
    </div>
  </div>
</header>
