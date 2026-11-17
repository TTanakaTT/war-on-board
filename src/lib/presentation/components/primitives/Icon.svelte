<script lang="ts">
  import type { TransitionConfig } from "svelte/transition";
  import { CUSTOM_PIECE_ICONS, type IconShape } from "#lib/presentation/constants/CustomIcons.ts";
  import {
    MATERIAL_ICON_PATHS,
    MATERIAL_ICON_VIEW_BOX,
  } from "#lib/presentation/constants/MaterialIcons.ts";

  type TransitionFunc = (node: Element, params: Record<string, unknown>) => TransitionConfig;

  interface Props {
    icon: string;
    size?: number;
    additionalClass?: string;
    transition?: TransitionFunc;
    transitionParams?: Record<string, unknown>;
  }

  let {
    icon = "",
    size = 48,
    additionalClass = "",
    transition: transitionFn,
    transitionParams = {},
  }: Props = $props();

  // Piece types with no Material Symbols equivalent (e.g. archer, siege) use a
  // custom shape instead, consistently across every UI context — see CustomIcons.ts.
  let customIconShapes = $derived(CUSTOM_PIECE_ICONS[icon]);
  let materialIconPath = $derived(MATERIAL_ICON_PATHS[icon]);
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

{#snippet svgIcon(svgClass: string)}
  {#if customIconShapes}
    <svg class={svgClass} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {@render customIcon(customIconShapes)}
    </svg>
  {:else if materialIconPath}
    <svg
      class={svgClass}
      viewBox={MATERIAL_ICON_VIEW_BOX}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={materialIconPath} />
    </svg>
  {/if}
{/snippet}

{#if transitionFn}
  <span
    class="flex shrink-0 items-center justify-center {additionalClass}"
    transition:transitionFn|global={transitionParams}
  >
    {@render svgIcon("")}
  </span>
{:else}
  {@render svgIcon(`inline-block shrink-0 ${additionalClass}`)}
{/if}
