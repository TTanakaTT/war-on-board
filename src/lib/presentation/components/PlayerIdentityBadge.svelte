<script lang="ts">
  import { Player } from "$lib/domain/enums/Player";
  import type { PlayerSnapshot } from "$lib/domain/types/api";
  import Icon from "$lib/presentation/components/Icon.svelte";

  interface Props {
    player: Player | PlayerSnapshot;
    label: string;
    resource?: number;
    additionalClass?: string;
  }

  let { player, label, resource, additionalClass = "" }: Props = $props();

  let isFirstPlayer = $derived(player === Player.SELF || player === "self");
  let toneClass = $derived(isFirstPlayer ? "border-white text-white" : "border-black text-black");
</script>

<div
  class="bg-resource flex items-end gap-y-2 rounded-lg border-2 px-3 py-1.5 {toneClass} {additionalClass}"
>
  <Icon icon="home" size={22} />

  {#if resource !== undefined}
    <span class="mb-1 text-sm leading-none font-semibold">{label}</span>
    <span class="ms-2 text-2xl leading-none font-bold">{resource}</span>
  {:else}
    <span class="mb-1 text-sm font-semibold">{label}</span>
  {/if}
</div>
