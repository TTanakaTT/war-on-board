<script lang="ts">
  import { PanelsService } from "$lib/services/PanelService";
  import { PiecesRepository } from "$lib/data/repositories/PieceRepository";

  import { PanelState } from "$lib/domain/enums/PanelState";
  import { slide } from "svelte/transition";
  import { Player } from "$lib/domain/enums/Player";
  import type { PanelPosition } from "$lib/domain/entities/PanelPosition";
  import Sprout from "svelte-material-icons/Sprout.svelte";
  import Castle from "svelte-material-icons/Castle.svelte";

  let {
    panelPosition,
    onclick,
  }: {
    panelPosition: PanelPosition;
    onclick: () => void;
  } = $props();

  let pieces = $derived(PiecesRepository.getPiecesByPosition(panelPosition));

  let panel = $derived(PanelsService.find(panelPosition));
  let player = $derived(panel?.player);
  let castle = $derived(panel?.castle);
  let resource = $derived(panel?.resource);

  let panelState = $derived(panel?.panelState);
  let panelStyle = $derived(getPanelStyle());
  let pieceColor = $derived(
    pieces[0]?.player === Player.SELF ? "text-white border-white" : "text-black border-black",
  );
  let resourceColor = $derived(
    panel?.player === Player.SELF ? "text-white border-white" : "text-black border-black",
  );

  function onkeydown(e: KeyboardEvent) {
    if (!["Enter", " "].includes(e.key)) return;
    if (
      panelState &&
      ![PanelState.OCCUPIED, PanelState.SELECTED, PanelState.MOVABLE].includes(panelState)
    )
      return;

    if (pieces?.length === 0) return;

    onclick();
  }

  function getPanelStyle(): string {
    let _panelState: PanelState;
    if (panelState) {
      _panelState = panelState;
    } else if (pieces?.length) {
      _panelState = PanelState.OCCUPIED;
    } else {
      _panelState = PanelState.UNOCCUPIED;
    }
    let playerStyle;

    switch (player) {
      case Player.SELF:
        playerStyle = "all-el:border-y-2 all-el:border-white all-el:border-dotted";
        break;
      case Player.OPPONENT:
        playerStyle = "all-el:border-y-2 all-el:border-black all-el:border-dotted";
        break;
      default:
        playerStyle = "all-el:border-y all-el:border-outline dark:all-el:border-outline-dark";
    }
    let hoverStyle = "hover:all-el:bg-panel-selected dark:hover:all-el:bg-panel-selected-dark";
    switch (_panelState) {
      case PanelState.UNOCCUPIED:
        return `pointer-events-none ${playerStyle} all-el:bg-panel-unoccupied dark:all-el:bg-panel-unoccupied-dark`;
      case PanelState.OCCUPIED:
        return `cursor-pointer ${playerStyle} ${hoverStyle} all-el:bg-panel-occupied dark:all-el:bg-panel-occupied-dark`;
      case PanelState.SELECTED:
      case PanelState.MOVABLE:
        return `cursor-pointer ${playerStyle} ${hoverStyle} all-el:bg-panel-movable dark:all-el:bg-panel-movable-dark`;
      case PanelState.IMMOVABLE:
      default:
        return `pointer-events-none ${playerStyle} all-el:bg-panel-immovable dark:all-el:bg-panel-immovable-dark`;
    }
  }
</script>

<div
  class="pseudo-el:content-[''] all-el:transition-all all-el:duration-400 all-el:ease-out hover:all-el:transition-all hover:all-el:duration-200 hover:all-el:ease-out pseudo-el:-top-px pseudo-el:absolute all-el:h-25 all-el:w-[calc(100px/1.73)] relative mx-0 my-2.5 flex flex-col before:rotate-60 after:-rotate-60 {panelStyle}"
  role="button"
  tabindex="0"
  {onclick}
  {onkeydown}
>
  <div class="text-castle z-1 flex flex-1 items-start">
    {#if castle && castle > 0}
      <i transition:slide={{ duration: 500, axis: "y" }}>
        <Castle
          class="
				 my-0.5 size-6"
        />
      </i>
      <p
        class="bg-castle flex size-6 items-center justify-center rounded-xl border {resourceColor}"
      >
        {castle}
      </p>
    {/if}
  </div>

  <div class="z-1 flex items-center justify-center">
    <div class="flex flex-row gap-2">
      {#each pieces as piece (piece.id)}
        {#snippet icon()}
          {@const Icon = piece.pieceType.getComponent()}
          <Icon
            class="bg-primary-variant dark:bg-primary-variant-dark size-9 rounded-xl border p-1 {pieceColor}"
          />
        {/snippet}

        <i transition:slide={{ duration: 500, axis: "y" }}>
          {@render icon()}
        </i>
      {/each}
    </div>
  </div>

  <div class="text-resource z-1 flex flex-1 items-end">
    {#if resource && resource > 0}
      <i transition:slide={{ duration: 500, axis: "y" }}>
        <Sprout
          class=" 
				 my-0.5 size-6"
        />
      </i>
      <p
        class="bg-resource flex size-6 items-center justify-center rounded-xl border {resourceColor}"
      >
        {resource}
      </p>
    {/if}
  </div>
</div>
