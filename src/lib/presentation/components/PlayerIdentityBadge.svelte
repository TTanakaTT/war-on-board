<script lang="ts">
  import { Player } from "$lib/domain/enums/Player";
  import type { PlayerSnapshot } from "$lib/domain/types/api";
  import Icon from "$lib/presentation/components/Icon.svelte";

  interface Props {
    player: Player | PlayerSnapshot;
    label: string;
    resource?: number;
    additionalClass?: string;
    compact?: boolean;
    previewCost?: number;
  }

  let {
    player,
    label,
    resource,
    additionalClass = "",
    compact = false,
    previewCost,
  }: Props = $props();

  let isFirstPlayer = $derived(player === Player.SELF || player === "self");
  let toneClass = $derived(isFirstPlayer ? "border-white text-white" : "border-black text-black");
  let ariaLabel = $derived(resource === undefined ? label : `${label}: ${resource}`);
</script>

<div
  class="bg-resource flex items-end gap-y-2 rounded-lg border-2 px-1 py-1.5 {toneClass} {additionalClass}"
  title={compact ? label : undefined}
  aria-label={ariaLabel}
>
  <Icon icon="home" size={22} />

  {#if resource !== undefined}
    {#if !compact}
      <span class="mb-1 text-sm leading-none font-semibold">{label}</span>
    {/if}
    <span class="relative ms-2 flex min-w-12 items-start justify-end pe-5">
      <span class="text-2xl leading-none font-bold">{resource}</span>
      {#if previewCost !== undefined}
        <span class="absolute top-0 right-0 text-xs leading-none font-semibold">
          -{previewCost}
        </span>
      {/if}
    </span>
  {:else}
    <span class="mb-1 text-sm font-semibold">{label}</span>
  {/if}
</div>
