<script lang="ts">
  import HexagonPanel from "./HexagonPanel.svelte";
  import { PanelPosition } from "$lib/domain/entities/PanelPosition";
  import { InteractionService } from "$lib/services/InteractionService";
  import { LayerRepository } from "$lib/data/repositories/LayerRepository";
  import MoveArrows from "./MoveArrows.svelte";
  import MovingPiecePreview from "./MovingPiecePreview.svelte";
  import { BoardLayout } from "$lib/presentation/BoardLayout";
  import { BOARD_PANEL_VERTICAL_PIXEL_OFFSET } from "$lib/presentation/constants/BoardLayoutConstants";
  import {
    DESKTOP_NAVIGATION_BREAKPOINT_PX,
    MOBILE_BOARD_VIEWPORT_GUTTER_PX,
    MOBILE_GAME_HEADER_HEIGHT_PX,
  } from "$lib/presentation/constants/UiConstants";

  let layer = $derived(LayerRepository.get());
  let windowWidth = $state(0);
  let windowHeight = $state(0);

  function sideRange(): number[] {
    const horizontalLayer = layer;
    const range = [];
    for (let i = -(horizontalLayer - 1); i < horizontalLayer; i++) {
      range.push(i);
    }
    return range;
  }

  const width = $derived(BoardLayout.boardWidth);
  const height = $derived(BoardLayout.boardHeight);
  const isMobileLayout = $derived(
    windowWidth > 0 && windowWidth < DESKTOP_NAVIGATION_BREAKPOINT_PX,
  );
  const boardScale = $derived.by(() => {
    if (!isMobileLayout || windowWidth === 0 || windowHeight === 0) {
      return 1;
    }

    const availableWidth = Math.max(windowWidth - MOBILE_BOARD_VIEWPORT_GUTTER_PX, 0);
    const availableHeight = Math.max(
      windowHeight - MOBILE_GAME_HEADER_HEIGHT_PX - MOBILE_BOARD_VIEWPORT_GUTTER_PX,
      0,
    );

    return Math.min(1, availableWidth / height, availableHeight / width);
  });
  const boardViewportStyle = $derived.by(() => {
    const viewportWidth = isMobileLayout ? height * boardScale : width;
    const viewportHeight = isMobileLayout ? width * boardScale : height;

    return `--board-width: ${width}px; --board-height: ${height}px; --board-scale: ${boardScale}; --board-viewport-width: ${viewportWidth}px; --board-viewport-height: ${viewportHeight}px;`;
  });
  const layeredPanelContainerStyle = $derived(`width: ${width}px; height: ${height}px;`);

  // Ratio between hexagon height and width for a regular pointy-top hexagon.
  const HEXAGON_HORIZONTAL_RATIO = Math.sqrt(3);
  function panelPositionStyle(hl: number, vl: number): string {
    const coords = BoardLayout.getCoordinates(
      new PanelPosition({ horizontalLayer: hl, verticalLayer: vl }),
    );
    // Adjust from center to top-left
    const left = coords.x - BoardLayout.HEIGHT / HEXAGON_HORIZONTAL_RATIO / 2;
    const top = coords.y - BoardLayout.HEIGHT / 2 - BOARD_PANEL_VERTICAL_PIXEL_OFFSET;
    return `position: absolute; left: ${left}px; top: ${top}px;`;
  }
</script>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<div class="flex h-full items-center justify-center overflow-auto p-4">
  <div
    class="relative h-(--board-viewport-height) w-(--board-viewport-width) shrink-0"
    style={boardViewportStyle}
  >
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-(--board-scale) -rotate-90 transform-gpu lg:scale-100 lg:rotate-0"
      style={layeredPanelContainerStyle}
    >
      {#each sideRange() as hl (hl)}
        {#each { length: layer - Math.abs(hl) }, vl}
          <div style={panelPositionStyle(hl, vl)}>
            <HexagonPanel
              panelPosition={new PanelPosition({
                horizontalLayer: hl,
                verticalLayer: vl,
              })}
              onclick={() =>
                InteractionService.panelChange(
                  new PanelPosition({
                    horizontalLayer: hl,
                    verticalLayer: vl,
                  }),
                )}
            />
          </div>
        {/each}
      {/each}
      <MoveArrows />
      <MovingPiecePreview />
    </div>
  </div>
</div>
