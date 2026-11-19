<script lang="ts">
  import HexagonPanel from "./HexagonPanel.svelte";
  import { pos } from "#lib/domain/model.ts";
  import { LayerRepository } from "#lib/store.svelte.ts";
  import { InteractionService } from "#lib/services/InteractionService.ts";
  import MoveArrows from "./MoveArrows.svelte";
  import MovingPiecePreview from "./MovingPiecePreview.svelte";
  import TransitPieceTokens from "./TransitPieceTokens.svelte";
  import RangedAttackModeButton from "./RangedAttackModeButton.svelte";
  import {
    BoardLayout,
    BOARD_PANEL_VERTICAL_PIXEL_OFFSET,
    DESKTOP_NAVIGATION_BREAKPOINT_PX,
    MOBILE_BOARD_VIEWPORT_GUTTER_PX,
    MOBILE_GAME_HEADER_HEIGHT_PX,
  } from "#lib/presentation/layout.ts";

  let layer = $derived(LayerRepository.get());
  let windowWidth = $state(0);
  let windowHeight = $state(0);

  const sideRange = () => Array.from({ length: layer * 2 - 1 }, (_, i) => i - (layer - 1));

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

  function panelPositionStyle(hl: number, vl: number): string {
    const coords = BoardLayout.getCoordinates(pos(hl, vl));
    // Center to top-left.
    const left = coords.x - BoardLayout.HEIGHT / Math.sqrt(3) / 2;
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
              panelPosition={pos(hl, vl)}
              onclick={() => InteractionService.panelChange(pos(hl, vl))}
            />
          </div>
        {/each}
      {/each}
      <MoveArrows />
      <TransitPieceTokens />
      <MovingPiecePreview />
    </div>

    <RangedAttackModeButton />
  </div>
</div>
