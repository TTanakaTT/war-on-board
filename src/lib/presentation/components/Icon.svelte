<script lang="ts">
  import type { TransitionConfig } from "svelte/transition";

  type TransitionFunc = (node: Element, params: Record<string, unknown>) => TransitionConfig;

  interface Props {
    icon: string;
    size?: number;
    fill?: boolean;
    weight?: number;
    additionalClass?: string;
    transition?: TransitionFunc;
    transitionParams?: Record<string, unknown>;
  }

  let {
    icon = "",
    size = 48,
    fill = false,
    weight = 400,
    additionalClass = "",
    transition: transitionFn,
    transitionParams = {},
  }: Props = $props();

  let font = $derived(`font-variation-settings: 'FILL' ${fill ? 1 : 0}, 'wght' ${weight};`);
  let styleAttr = $derived(`font-size:${size}px;`);
</script>

{#if transitionFn}
  <span
    class="material-symbols-outlined inline-block {additionalClass}"
    style="{font} {styleAttr}"
    transition:transitionFn|global={transitionParams}
  >
    {icon}
  </span>
{:else}
  <span class="material-symbols-outlined inline-block {additionalClass}" style="{font} {styleAttr}">
    {icon}
  </span>
{/if}
