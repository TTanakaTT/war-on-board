<script lang="ts">
  import type { TransitionConfig } from "svelte/transition";
  import { CUSTOM_PIECE_ICONS, type IconShape } from "$lib/presentation/constants/CustomIcons";

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
  // See docs/adr/0001-piece-token-custom-svg-icons.md — a narrow exception for piece
  // tokens whose icon has no material-symbols equivalent (e.g. archer, Siege).
  let customIconShapes = $derived(CUSTOM_PIECE_ICONS[icon]);
</script>

{#snippet customIcon(shapes: IconShape[])}
  {#each shapes as shape, index (index)}
    {#if shape.type === "path"}
      <path
        d={shape.d}
        fill="none"
        stroke="currentColor"
        stroke-width={shape.strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {:else if shape.type === "line"}
      <line
        x1={shape.x1}
        y1={shape.y1}
        x2={shape.x2}
        y2={shape.y2}
        stroke="currentColor"
        stroke-width={shape.strokeWidth}
        stroke-linecap="round"
      />
    {:else if shape.type === "polygon"}
      <polygon points={shape.points} fill="currentColor" />
    {:else if shape.type === "circle"}
      <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill="currentColor" />
    {/if}
  {/each}
{/snippet}

{#if transitionFn}
  <span
    class="flex items-center justify-center {additionalClass}"
    transition:transitionFn|global={transitionParams}
  >
    {#if customIconShapes}
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        aria-hidden="true"
        style={styleAttr}
      >
        {@render customIcon(customIconShapes)}
      </svg>
    {:else}
      <span class="material-symbols-outlined" style="{font} {styleAttr}">{icon}</span>
    {/if}
  </span>
{:else if customIconShapes}
  <svg
    class="inline-block {additionalClass}"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    role="img"
    aria-hidden="true"
    style={styleAttr}
  >
    {@render customIcon(customIconShapes)}
  </svg>
{:else}
  <span class="material-symbols-outlined inline-block {additionalClass}" style="{font} {styleAttr}">
    {icon}
  </span>
{/if}
