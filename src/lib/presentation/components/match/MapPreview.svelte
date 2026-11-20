<script lang="ts">
  import {
    gameMapConfig,
    Player,
    terrainConfig,
    type GameMapId,
    type Panel,
  } from "#lib/domain/model.ts";
  import { m } from "#lib/paraglide/messages.js";
  import { MATERIAL_ICON_PATHS, MATERIAL_ICON_VIEW_BOX } from "#lib/presentation/icons.ts";
  import { mapLabel } from "#lib/presentation/labels.ts";
  import {
    BoardLayout,
    MAP_PREVIEW_ICON_RATIO,
    MAP_PREVIEW_WIDTH_PX,
  } from "#lib/presentation/layout.ts";
  import { terrainIconFillClass } from "#lib/presentation/terrain.ts";
  import { PanelsService } from "#lib/services/PanelService.ts";

  let { map }: { map: GameMapId } = $props();

  const MATERIAL_ICON_UNITS = Number(MATERIAL_ICON_VIEW_BOX.split(" ")[3]);
  const HALF_HEIGHT = BoardLayout.HEIGHT / 2;
  const SIDE = BoardLayout.horizontalSideLength;
  const ICON_SIZE = BoardLayout.HEIGHT * MAP_PREVIEW_ICON_RATIO;

  let config = $derived(gameMapConfig(map));
  let panels = $derived(PanelsService.initialize(config.layer, config.terrains));
  let width = $derived(BoardLayout.boardWidthFor(config.layer));
  let height = $derived(BoardLayout.boardHeightFor(config.layer));

  // Matches the game board, which is turned a quarter counterclockwise below the lg breakpoint.
  function place(panel: Panel, rotated: boolean) {
    const { x, y } = BoardLayout.getCoordinatesFor(panel.panelPosition, config.layer);
    return rotated ? { x: y, y: width - x } : { x, y };
  }

  function hexagonPoints(panel: Panel, rotated: boolean): string {
    const { x, y } = BoardLayout.getCoordinatesFor(panel.panelPosition, config.layer);
    const corners = [
      [x - SIDE, y],
      [x - SIDE / 2, y - HALF_HEIGHT],
      [x + SIDE / 2, y - HALF_HEIGHT],
      [x + SIDE, y],
      [x + SIDE / 2, y + HALF_HEIGHT],
      [x - SIDE / 2, y + HALF_HEIGHT],
    ];
    return corners.map(([cx, cy]) => (rotated ? `${cy},${width - cx}` : `${cx},${cy}`)).join(" ");
  }

  function polygonClass(panel: Panel): string {
    if (!terrainConfig(panel.terrain).passable) {
      return "fill-panel-mountain dark:fill-panel-mountain-dark stroke-outline dark:stroke-outline-dark stroke-2";
    }
    switch (panel.player) {
      case Player.SELF:
        return "fill-panel-unoccupied dark:fill-panel-unoccupied-dark stroke-player-self stroke-8";
      case Player.OPPONENT:
        return "fill-panel-unoccupied dark:fill-panel-unoccupied-dark stroke-player-opponent stroke-8";
      default:
        return "fill-panel-unoccupied dark:fill-panel-unoccupied-dark stroke-outline dark:stroke-outline-dark stroke-2";
    }
  }

  function iconTransform(panel: Panel, rotated: boolean): string {
    const { x, y } = place(panel, rotated);
    const scale = ICON_SIZE / MATERIAL_ICON_UNITS;
    return `translate(${x - ICON_SIZE / 2} ${y - ICON_SIZE / 2}) scale(${scale}) translate(0 ${MATERIAL_ICON_UNITS})`;
  }
</script>

{#snippet board(rotated: boolean)}
  <svg
    class="h-auto max-w-full"
    style="width: {MAP_PREVIEW_WIDTH_PX}px;"
    viewBox={rotated ? `0 0 ${height} ${width}` : `0 0 ${width} ${height}`}
    role="img"
    aria-label="{m.map_label()}: {mapLabel(map)}"
  >
    {#each panels as panel (`${panel.panelPosition.horizontalLayer},${panel.panelPosition.verticalLayer}`)}
      {@const iconName = terrainConfig(panel.terrain).iconName}
      {@const iconPath = iconName ? MATERIAL_ICON_PATHS[iconName] : undefined}
      <polygon
        points={hexagonPoints(panel, rotated)}
        class={polygonClass(panel)}
        stroke-linejoin="round"
      />
      {#if iconPath}
        <path
          d={iconPath}
          transform={iconTransform(panel, rotated)}
          class={terrainIconFillClass(panel.terrain)}
        />
      {/if}
    {/each}
  </svg>
{/snippet}

<div class="lg:hidden">{@render board(true)}</div>
<div class="hidden lg:block">{@render board(false)}</div>
