<script lang="ts">
  import { tick } from "svelte";
  import { page } from "$app/state";
  import { GameApi } from "$lib/api/GameApi";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { m } from "$lib/paraglide/messages";
  import DesktopGameHeaderControls from "$lib/presentation/components/game-header/DesktopGameHeaderControls.svelte";
  import MobileGameHeaderControls from "$lib/presentation/components/game-header/MobileGameHeaderControls.svelte";
  import IconButton from "$lib/presentation/components/primitives/IconButton.svelte";
  import { DESKTOP_NAVIGATION_BREAKPOINT_PX } from "$lib/presentation/constants/UiConstants";
  import { playerDisplayName } from "$lib/presentation/matchPresentation";
  import { GameDialogService } from "$lib/services/GameDialogService";
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
    if (!isNav || !open) {
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
  let windowWidth = $state(0);
  let selfLabel = $derived(
    playerDisplayName("self", matchControl.controllers, matchControl.aiStrengths),
  );
  let opponentLabel = $derived(
    playerDisplayName("opponent", matchControl.controllers, matchControl.aiStrengths),
  );
  let generationModeLabel = $derived(
    generationMode === "rear" ? m.generation_rear() : m.generation_front(),
  );
  let isRotatedBoardLayout = $derived(
    isGamePage && windowWidth > 0 && windowWidth < DESKTOP_NAVIGATION_BREAKPOINT_PX,
  );
  let generationModeIcon = $derived.by(() => {
    if (isRotatedBoardLayout) {
      return generationMode === "rear" ? "arrow_downward" : "arrow_upward";
    }

    return generationMode === "rear" ? "arrow_back" : "arrow_forward";
  });
  const generateMenuPieceTypes = [PieceType.KNIGHT, PieceType.ROOK, PieceType.BISHOP] as const;
  let controlsViewport = $state<HTMLDivElement | undefined>(undefined);
  let measurementStrip = $state<HTMLDivElement | undefined>(undefined);
  let isHeaderCompact = $state(false);

  let hoveredGenerationCost = $state<number | undefined>(undefined);
  let isGenerateMenuOpen = $state(false);

  function toggleGenerationMode(): void {
    if (!isHumanTurn || isAutomationRunning || turn.winner !== null) {
      return;
    }

    const currentMode = turn.generationMode[String(turn.player)] ?? "rear";
    GameApi.setGenerationMode(turn.player, currentMode === "rear" ? "front" : "rear");
  }

  function openLeaveDialog(): void {
    GameDialogService.requestLeaveDialog();
  }

  async function updateHeaderCompactMode(): Promise<void> {
    await tick();

    if (!isGamePage || !controlsViewport || !measurementStrip) {
      isHeaderCompact = false;
      return;
    }

    isHeaderCompact = measurementStrip.scrollWidth > controlsViewport.clientWidth;
  }

  function toggleGenerateMenu(): void {
    isGenerateMenuOpen = !isGenerateMenuOpen;
  }

  function handleGenerationCostPreview(previewCost: number | undefined): void {
    hoveredGenerationCost = previewCost;
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

  $effect(() => {
    const gamePage = isGamePage;

    if (!gamePage) {
      isGenerateMenuOpen = false;
    }
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

<header
  class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed inset-s-0 top-0 z-20 border-b shadow-md transition-[margin-left,width] duration-200 ease-out"
  style={headerWidthStyle}
>
  <div class="hidden items-center gap-3 px-4 py-1 lg:flex">
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
            <DesktopGameHeaderControls
              compact={false}
              currentPlayer={turn.player}
              {selfLabel}
              {selfResources}
              {opponentLabel}
              {opponentResources}
              {hoveredGenerationCost}
              {generationModeLabel}
              {generationModeIcon}
              {isHumanTurn}
              {isAutomationRunning}
              winner={turn.winner}
              onToggleGenerationMode={toggleGenerationMode}
              onPreviewChange={handleGenerationCostPreview}
              onOpenLeaveDialog={openLeaveDialog}
            />
          </div>
        </div>

        <div
          bind:this={controlsViewport}
          class="text-onsurface dark:text-onsurface-dark flex flex-nowrap items-center justify-end gap-2 overflow-x-hidden"
        >
          <DesktopGameHeaderControls
            compact={isHeaderCompact}
            currentPlayer={turn.player}
            {selfLabel}
            {selfResources}
            {opponentLabel}
            {opponentResources}
            {hoveredGenerationCost}
            {generationModeLabel}
            {generationModeIcon}
            {isHumanTurn}
            {isAutomationRunning}
            winner={turn.winner}
            onToggleGenerationMode={toggleGenerationMode}
            onPreviewChange={handleGenerationCostPreview}
            onOpenLeaveDialog={openLeaveDialog}
          />
        </div>
      </div>
    {/if}
  </div>

  <div
    class={isGamePage
      ? "relative min-h-28 overflow-visible px-2 py-1 lg:hidden"
      : "flex h-16 items-center px-2 py-1 lg:hidden"}
  >
    {#if isGamePage}
      <MobileGameHeaderControls
        {opponentLabel}
        {opponentResources}
        {selfLabel}
        {selfResources}
        currentPlayer={turn.player}
        {hoveredGenerationCost}
        {generationModeLabel}
        {generationModeIcon}
        {isGenerateMenuOpen}
        {generateMenuPieceTypes}
        {isHumanTurn}
        {isAutomationRunning}
        winner={turn.winner}
        {onClickMenu}
        onOpenLeaveDialog={openLeaveDialog}
        onToggleGenerateMenu={toggleGenerateMenu}
        onToggleGenerationMode={toggleGenerationMode}
        onPreviewChange={handleGenerationCostPreview}
      />
    {:else}
      <div class="flex w-full items-center justify-between">
        <IconButton icon="menu" label={m.drawer_title()} onclick={onClickMenu} />
      </div>
    {/if}
  </div>
</header>
