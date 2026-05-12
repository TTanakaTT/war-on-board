<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { GameDialogRepository } from "$lib/data/repositories/GameDialogRepository";
  import { LayerRepository } from "$lib/data/repositories/LayerRepository";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import { m } from "$lib/paraglide/messages";
  import AppButton from "$lib/presentation/components/primitives/AppButton.svelte";
  import IconButton from "$lib/presentation/components/primitives/IconButton.svelte";
  import MatchHistoryPanel from "./MatchHistoryPanel.svelte";
  import { HistoryExportService } from "$lib/services/HistoryExportService";
  import { GameDialogService } from "$lib/services/GameDialogService";
  import { MatchService } from "$lib/services/MatchService";
  import { MatchHistoryService } from "$lib/services/MatchHistoryService";

  const GAME_DIALOG_TITLE_ID = "game-dialog-modal-title";

  let dialog = $state<HTMLDialogElement | undefined>(undefined);
  let previousFocusedElement = $state<HTMLElement | null>(null);
  let turn = $derived(TurnRepository.get());
  let matchControl = $derived(MatchControlRepository.get());
  let dialogState = $derived(GameDialogRepository.get());
  let matchHistory = $derived(MatchHistoryService.getExportData());
  let isAutomationStopped = $derived(
    turn.winner === null &&
      matchControl.automation.status === "stopped" &&
      matchControl.automation.stopReason !== null,
  );
  let resultSignature = $derived.by(() => {
    if (turn.winner === Player.SELF) {
      return "winner-self";
    }

    if (turn.winner === Player.OPPONENT) {
      return "winner-opponent";
    }

    if (isAutomationStopped) {
      return `automation-${matchControl.automation.stopReason}`;
    }

    return null;
  });
  let isResultDialog = $derived(
    resultSignature !== null &&
      (dialogState.dismissedResultSignature !== resultSignature || dialogState.leaveRequested),
  );
  let isLeaveDialog = $derived(resultSignature === null && dialogState.leaveRequested);
  let showModal = $derived(isResultDialog || isLeaveDialog);
  let dialogWidthClass = $derived(
    isResultDialog
      ? "w-fit max-w-[calc(100vw-2rem)] sm:min-w-[42rem] sm:max-w-3xl"
      : "w-fit max-w-[calc(100vw-2rem)]",
  );

  function downloadHistory(): void {
    const historyJson = HistoryExportService.toJson();
    const blob = new Blob([historyJson], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `war-on-board-history-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  function closeDialog(): void {
    GameDialogService.closeDialog(isResultDialog ? resultSignature : null);
  }

  function handleDialogCancel(event: Event): void {
    event.preventDefault();
    closeDialog();
  }

  function restartMatch(): void {
    MatchService.startMatch({
      controllers: {
        self: matchControl.controllers.self,
        opponent: matchControl.controllers.opponent,
      },
      layer: LayerRepository.get(),
      automationTurnLimit: matchControl.automation.turnLimit,
      aiStrengths: {
        self: matchControl.aiStrengths.self,
        opponent: matchControl.aiStrengths.opponent,
      },
    });
  }

  async function backToGameSelection(): Promise<void> {
    GameDialogService.reset();
    await goto(resolve("/"));
  }

  $effect(() => {
    if (typeof document === "undefined" || !dialog) {
      return;
    }

    if (showModal) {
      if (dialog.open) {
        return;
      }

      const activeElement = document.activeElement;
      previousFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;
      dialog.showModal();
      dialog.focus();
      return;
    }

    if (!dialog.open) {
      return;
    }

    dialog.close();
    previousFocusedElement?.focus();
    previousFocusedElement = null;
  });
</script>

<dialog
  bind:this={dialog}
  aria-modal="true"
  aria-labelledby={GAME_DIALOG_TITLE_ID}
  tabindex="-1"
  class="fixed inset-0 z-2000 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-4"
  oncancel={handleDialogCancel}
>
  {#if showModal}
    <div class="flex h-full items-center justify-center">
      <div
        class="bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark flex max-h-[85vh] flex-col gap-6 overflow-hidden rounded-2xl p-4 shadow-2xl {dialogWidthClass}"
      >
        <div class="grid min-h-8 w-full grid-cols-[3rem_minmax(0,1fr)_3rem] items-center gap-3">
          <div aria-hidden="true"></div>

          <h2 id={GAME_DIALOG_TITLE_ID} class="text-center text-2xl leading-none font-bold">
            {isResultDialog ? m.match_finished_title() : m.leave_match()}
          </h2>

          <IconButton
            icon="close"
            label={m.close_dialog()}
            onclick={closeDialog}
            additionalClass="place-self-center justify-self-end"
          />
        </div>

        {#if isAutomationStopped}
          <div class="text-center text-lg">
            {m.automation_turn_limit_message({ turnLimit: matchControl.automation.turnLimit })}
          </div>
        {/if}

        {#if isResultDialog}
          <MatchHistoryPanel {matchHistory} onDownloadHistory={downloadHistory} />
        {/if}

        <div class="flex flex-wrap justify-center gap-3">
          <AppButton onclick={restartMatch}>
            {m.restart_match()}
          </AppButton>
          <AppButton onclick={backToGameSelection}>
            {m.back_to_game_selection()}
          </AppButton>
        </div>
      </div>
    </div>
  {/if}
</dialog>
