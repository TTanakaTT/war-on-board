<script lang="ts">
  import HexagonPanel from "./HexagonPanel.svelte";
  import { PanelPosition } from "$lib/domain/entities/PanelPosition";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { GameService } from "$lib/services/GameService";
  import { Player } from "$lib/domain/enums/Player";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { LayerRepository } from "$lib/data/repositories/LayerRepository";
  import GeneratePieceButton from "$lib/presentation/components/GeneratePieceButton.svelte";
  import EndTurnButton from "$lib/presentation/components/EndTurnButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import MoveArrows from "./MoveArrows.svelte";
  import { slide } from "svelte/transition";
  import { BoardLayoutService } from "$lib/services/BoardLayoutService";

  let turn = $derived(TurnRepository.get());
  let selfResources = $derived(turn.resources[String(Player.SELF)] ?? 0);
  let opponentResources = $derived(turn.resources[String(Player.OPPONENT)] ?? 0);

  const layer = LayerRepository.get();

  function sideRange(): number[] {
    const horizontalLayer = layer;
    const range = [];
    for (let i = -(horizontalLayer - 1); i < horizontalLayer; i++) {
      range.push(i);
    }
    return range;
  }

  const width = $derived(BoardLayoutService.boardWidth);
  const height = $derived(BoardLayoutService.boardHeight);
  const layeredPanelContainerStyle = $derived(
    `width: ${width}px; height: ${height}px; position: relative;`,
  );

  function panelPositionStyle(hl: number, vl: number): string {
    const coords = BoardLayoutService.getCoordinates(
      new PanelPosition({ horizontalLayer: hl, verticalLayer: vl }),
    );
    // Adjust from center to top-left
    const left = coords.x - BoardLayoutService.HEIGHT / 1.73 / 2;
    const top = coords.y - BoardLayoutService.HEIGHT / 2 - 5;
    return `position: absolute; left: ${left}px; top: ${top}px;`;
  }

  let turnColor = $derived(
    turn.player === Player.SELF ? "text-white border-white" : "text-black border-black",
  );
</script>

<div class="m-2 flex justify-center gap-4">
  <span
    class="bg-primary-variant dark:bg-primary-variant-dark rounded-xl border-2 p-1.5 text-sm {turnColor}"
    >turn<span class="text-2xl font-bold">{turn.num}</span> {turn.player}</span
  >
  <EndTurnButton />
</div>

<div class="m-2 flex justify-center">
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
              GameService.panelChange(
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
  </div>
</div>

<div class="my-2 flex justify-center gap-2">
  <div
    class="bg-resource flex items-center justify-center gap-1 rounded-lg border-2 border-white pr-2 pl-1 text-white"
  >
    <Icon
      icon="home"
      size={24}
      transition={slide}
      transitionParams={{ duration: 500, axis: "y" }}
    />

    <div class="text-2xl">{selfResources}</div>
  </div>

  <GeneratePieceButton pieceType={PieceType.KNIGHT} />
  <GeneratePieceButton pieceType={PieceType.ROOK} />
  <GeneratePieceButton pieceType={PieceType.BISHOP} />

  <div
    class="bg-resource flex items-center justify-center gap-1 rounded-lg border-2 border-black pr-2 pl-1 text-black"
  >
    <Icon
      icon="home"
      size={24}
      transition={slide}
      transitionParams={{ duration: 500, axis: "y" }}
    />

    <div class="text-2xl">{opponentResources}</div>
  </div>
</div>
