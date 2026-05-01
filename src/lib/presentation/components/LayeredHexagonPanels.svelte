<script lang="ts">
  import HexagonPanel from "./HexagonPanel.svelte";
  import { PanelPosition } from "$lib/domain/entities/PanelPosition";
  import { InteractionService } from "$lib/services/InteractionService";
  import { LayerRepository } from "$lib/data/repositories/LayerRepository";
  import MoveArrows from "./MoveArrows.svelte";
  import MovingPiecePreview from "./MovingPiecePreview.svelte";
  import { BoardLayout } from "$lib/presentation/BoardLayout";

  let layer = $derived(LayerRepository.get());

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
  const layeredPanelContainerStyle = $derived(
    `width: ${width}px; height: ${height}px; position: relative;`,
  );

  // Ratio between hexagon height and width for a regular pointy-top hexagon.
  const HEXAGON_HORIZONTAL_RATIO = Math.sqrt(3);
  // Additional vertical adjustment (in px) to align the rendered panel visually.
  const PANEL_VERTICAL_PIXEL_OFFSET = 5;
  function panelPositionStyle(hl: number, vl: number): string {
    const coords = BoardLayout.getCoordinates(
      new PanelPosition({ horizontalLayer: hl, verticalLayer: vl }),
    );
    // Adjust from center to top-left
    const left = coords.x - BoardLayout.HEIGHT / HEXAGON_HORIZONTAL_RATIO / 2;
    const top = coords.y - BoardLayout.HEIGHT / 2 - PANEL_VERTICAL_PIXEL_OFFSET;
    return `position: absolute; left: ${left}px; top: ${top}px;`;
  }
</script>

<div class="flex h-full items-center justify-center p-4">
  <div style={layeredPanelContainerStyle}>
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
