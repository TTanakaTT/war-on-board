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
  import { m } from "$lib/paraglide/messages";
  import type { GenerationMode } from "$lib/domain/entities/Turn";

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

  let generationMode = $derived<GenerationMode>(
    (turn.generationMode[String(Player.SELF)] as GenerationMode) ?? "rear",
  );

  function toggleGenerationMode() {
    const currentTurn = TurnRepository.get();
    const currentMode = currentTurn.generationMode[String(Player.SELF)] ?? "rear";
    const newMode: GenerationMode = currentMode === "rear" ? "front" : "rear";
    TurnRepository.set({
      ...currentTurn,
      generationMode: {
        ...currentTurn.generationMode,
        [String(Player.SELF)]: newMode,
      },
    });
  }
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
  <button
    type="button"
    class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark flex items-center gap-1 rounded-3xl border px-3 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none"
    onclick={toggleGenerationMode}
  >
    <Icon icon={generationMode === "rear" ? "arrow_back" : "arrow_forward"} size={20} />
    <span class="text-sm"
      >{generationMode === "rear" ? m.generation_rear() : m.generation_front()}</span
    >
  </button>
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
