<script lang="ts">
  import { page } from "$app/state";
  import { GameDialogRepository } from "$lib/data/repositories/GameDialogRepository";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { GameApi } from "$lib/api/GameApi";
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
  }: {
    open: boolean;
    isNav: boolean;
    onClickMenu: () => void;
  } = $props();
  let headerWidthStyle = $derived.by(() => {
    if (isNav) {
      return open ? "ml-64 w-[calc(100%-(var(--spacing)*64))]" : "w-screen";
    } else {
      return "w-screen";
    }
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
</script>

<header
  class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed inset-s-0 top-0 z-20 border-b shadow-md {headerWidthStyle}"
>
  <div class="flex flex-wrap items-center gap-3 p-4">
    <IconButton icon="menu" label={m.drawer_title()} onclick={onClickMenu} />

    {#if isGamePage}
      <div
        class="text-onsurface dark:text-onsurface-dark flex flex-1 flex-wrap items-center justify-end gap-2"
      >
        <EndTurnButton />

        <PlayerIdentityBadge player="self" label={selfLabel} resource={selfResources} />

        <AppButton
          additionalClass="px-4"
          onclick={toggleGenerationMode}
          disabled={!isHumanTurn || isAutomationRunning || turn.winner !== null}
        >
          <Icon icon={generationMode === "rear" ? "arrow_back" : "arrow_forward"} size={20} />
          <span>{generationMode === "rear" ? m.generation_rear() : m.generation_front()}</span>
        </AppButton>

        <GeneratePieceButton pieceType={PieceType.KNIGHT} />
        <GeneratePieceButton pieceType={PieceType.ROOK} />
        <GeneratePieceButton pieceType={PieceType.BISHOP} />

        <PlayerIdentityBadge player="opponent" label={opponentLabel} resource={opponentResources} />

        <IconButton icon="exit_to_app" label={m.leave_match()} onclick={openLeaveDialog} />
      </div>
    {/if}
  </div>
</header>
