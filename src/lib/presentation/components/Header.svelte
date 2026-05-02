<script lang="ts">
  import { tick } from "svelte";
  import { page } from "$app/state";
  import { GameDialogRepository } from "$lib/data/repositories/GameDialogRepository";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { GameApi } from "$lib/api/GameApi";
  import { Player } from "$lib/domain/enums/Player";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import AppButton from "$lib/presentation/components/AppButton.svelte";
  import EndTurnButton from "$lib/presentation/components/EndTurnButton.svelte";
  import GeneratePieceButton from "$lib/presentation/components/GeneratePieceButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import IconButton from "$lib/presentation/components/IconButton.svelte";
  import PlayerIdentityBadge from "$lib/presentation/components/PlayerIdentityBadge.svelte";
  import { m } from "$lib/paraglide/messages";
  import { playerDisplayName } from "$lib/presentation/matchPresentation";
  import { MatchService } from "$lib/services/MatchService";
  let {
    open,
    isNav,
    onClickMenu,
    drawerWidthUnits,
  }: {
    open: boolean;
    isNav: boolean;
    onClickMenu: () => void;
    drawerWidthUnits: number;
  } = $props();
  let headerWidthStyle = $derived.by(() => {
    if (!isNav) {
      return "width: 100vw;";
    }

    if (!open) {
      return "width: 100vw;";
    }

    return `margin-left: calc(var(--spacing) * ${drawerWidthUnits}); width: calc(100vw - (var(--spacing) * ${drawerWidthUnits}));`;
  });
  let isGamePage = $derived(page.route.id === "/game");
  let matchControl = $derived(MatchControlRepository.get());
  let turn = $derived(TurnRepository.get());
  let selfResources = $derived(turn.resources.self ?? 0);
  let opponentResources = $derived(turn.resources.opponent ?? 0);
  let isHumanTurn = $derived(isGamePage && MatchService.getControllerForCurrentTurn() === "human");
  let isAutomationRunning = $derived(isGamePage && MatchService.isAutomationRunning());
  let generationMode = $derived(turn.generationMode[String(turn.player)] ?? "rear");
  let selfLabel = $derived(
    playerDisplayName("self", matchControl.controllers, matchControl.aiStrengths),
  );
  let opponentLabel = $derived(
    playerDisplayName("opponent", matchControl.controllers, matchControl.aiStrengths),
  );
  let generationModeLabel = $derived(
    generationMode === "rear" ? m.generation_rear() : m.generation_front(),
  );
  let controlsViewport = $state<HTMLDivElement | undefined>(undefined);
  let measurementStrip = $state<HTMLDivElement | undefined>(undefined);
  let isHeaderCompact = $state(false);
  let hoveredGenerationCost = $state<number | undefined>(undefined);

  function toggleGenerationMode(): void {
    if (!isHumanTurn || isAutomationRunning || turn.winner !== null) {
      return;
    }

    const currentMode = turn.generationMode[String(turn.player)] ?? "rear";
    GameApi.setGenerationMode(turn.player, currentMode === "rear" ? "front" : "rear");
  }

  function openLeaveDialog(): void {
    GameDialogRepository.requestLeaveDialog();
  }

  function handleGenerationCostPreview(previewCost: number | undefined): void {
    hoveredGenerationCost = previewCost;
  }

  async function updateHeaderCompactMode(): Promise<void> {
    await tick();

    if (!isGamePage || !controlsViewport || !measurementStrip) {
      isHeaderCompact = false;
      return;
    }

    isHeaderCompact = measurementStrip.scrollWidth > controlsViewport.clientWidth;
  }

  $effect(() => {
    void isGamePage;
    void controlsViewport;
    void measurementStrip;

    if (!isGamePage || !controlsViewport || !measurementStrip) {
      isHeaderCompact = false;
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      void updateHeaderCompactMode();
    });

    resizeObserver.observe(controlsViewport);
    resizeObserver.observe(measurementStrip);
    void updateHeaderCompactMode();

    return () => {
      resizeObserver.disconnect();
    };
  });

  $effect(() => {
    void selfLabel;
    void opponentLabel;
    void selfResources;
    void opponentResources;
    void generationModeLabel;
    void hoveredGenerationCost;
    void drawerWidthUnits;

    void updateHeaderCompactMode();
  });
</script>

{#snippet gameControls(compact: boolean)}
  <EndTurnButton {compact} />

  <PlayerIdentityBadge
    player="self"
    label={selfLabel}
    resource={selfResources}
    {compact}
    previewCost={turn.player === Player.SELF ? hoveredGenerationCost : undefined}
  />

  <div title={compact ? generationModeLabel : undefined} aria-label={generationModeLabel}>
    <AppButton
      additionalClass={compact ? "h-11 w-11 rounded-2xl px-0" : "px-4"}
      onclick={toggleGenerationMode}
      disabled={!isHumanTurn || isAutomationRunning || turn.winner !== null}
    >
      <Icon icon={generationMode === "rear" ? "arrow_back" : "arrow_forward"} size={20} />
      {#if !compact}
        <span>{generationModeLabel}</span>
      {/if}
    </AppButton>
  </div>

  <GeneratePieceButton
    pieceType={PieceType.KNIGHT}
    {compact}
    onPreviewChange={handleGenerationCostPreview}
  />
  <GeneratePieceButton
    pieceType={PieceType.ROOK}
    {compact}
    onPreviewChange={handleGenerationCostPreview}
  />
  <GeneratePieceButton
    pieceType={PieceType.BISHOP}
    {compact}
    onPreviewChange={handleGenerationCostPreview}
  />

  <PlayerIdentityBadge
    player="opponent"
    label={opponentLabel}
    resource={opponentResources}
    {compact}
    previewCost={turn.player === Player.OPPONENT ? hoveredGenerationCost : undefined}
  />

  <IconButton icon="exit_to_app" label={m.leave_match()} onclick={openLeaveDialog} />
{/snippet}

<header
  class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed inset-s-0 top-0 z-20 border-b shadow-md transition-[margin-left,width] duration-200 ease-out"
  style={headerWidthStyle}
>
  <div class="flex flex-wrap items-center gap-3 px-4 py-1">
    <IconButton icon="menu" label={m.drawer_title()} onclick={onClickMenu} />

    {#if isGamePage}
      <div class="flex-1">
        <div
          bind:this={measurementStrip}
          class="pointer-events-none invisible absolute top-0 right-0"
          aria-hidden="true"
        >
          <div
            class="text-onsurface dark:text-onsurface-dark flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap"
          >
            {@render gameControls(false)}
          </div>
        </div>

        <div
          bind:this={controlsViewport}
          class="text-onsurface dark:text-onsurface-dark flex flex-nowrap items-center justify-end gap-2 overflow-x-hidden"
        >
          {@render gameControls(isHeaderCompact)}
        </div>
      </div>
    {/if}
  </div>
</header>
