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

  const height = 100;

  const horizontalSideLength = height / Math.sqrt(3);
  const hypotenuseHorizontalLength = height / 2 / Math.sqrt(3);
  const horizontalLength = horizontalSideLength + hypotenuseHorizontalLength;
  const horizontalMargin = (height * 0.1 * Math.sqrt(3)) / 2;

  const width =
    horizontalLength * (layer * 2 - 1) +
    horizontalMargin * (layer * 2 - 2) +
    hypotenuseHorizontalLength;
  const layeredPanelWidthStyle = `width: ${width.toString()}px; `;

  function panelPositionStyle(horizontalLayer: number): string {
    const left =
      hypotenuseHorizontalLength * (layer + horizontalLayer) +
      horizontalMargin * (layer + horizontalLayer - 1);
    const top = Math.abs(horizontalLayer) * (height / 2) * 1.1;
    return `left: ${left.toString()}px; top: ${top.toString()}px`;
  }

  let turnColor = $derived(
    turn.player === Player.SELF ? "text-white border-white" : "text-black border-black",
  );
</script>

<div class="m-2 flex gap-4 justify-center">
  <span
    class="bg-primary-variant dark:bg-primary-variant-dark rounded-xl border-2 p-1.5 text-sm {turnColor}"
    >turn<span class="text-2xl font-bold">{turn.num}</span> {turn.player}</span
  >
  <EndTurnButton />
</div>

<div class="m-2 flex justify-center">
  <div style={layeredPanelWidthStyle}>
    {#each sideRange() as hl (hl)}
      <div class="relative float-left" style={panelPositionStyle(hl)}>
        {#each { length: layer - Math.abs(hl) }, vl}
          <div>
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
      </div>
    {/each}
  </div>
</div>

<div class="my-2 flex justify-center gap-2">
  <div
    class="bg-resource pl-1 pr-2 gap-1 flex items-center justify-center rounded-lg border-2 text-white border-white"
  >
    <Icon icon="home" size={24} />

    <div class="text-2xl">{selfResources}</div>
  </div>

  <GeneratePieceButton pieceType={PieceType.KNIGHT} />
  <GeneratePieceButton pieceType={PieceType.ROOK} />
  <GeneratePieceButton pieceType={PieceType.BISHOP} />

  <div
    class="bg-resource pl-1 pr-2 gap-1 flex items-center justify-center rounded-lg border-2 text-black border-black"
  >
    <Icon icon="home" size={24} />

    <div class="text-2xl">{opponentResources}</div>
  </div>
</div>
