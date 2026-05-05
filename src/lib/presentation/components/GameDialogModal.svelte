<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { GameDialogRepository } from "$lib/data/repositories/GameDialogRepository";
  import { LayerRepository } from "$lib/data/repositories/LayerRepository";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import type { ControllablePlayerSnapshot } from "$lib/domain/types/api";
  import type { MatchHistoryMetricPair } from "$lib/domain/types/history";
  import { m } from "$lib/paraglide/messages";
  import { playerDisplayName, seatLabel } from "$lib/presentation/matchPresentation";
  import AppButton from "$lib/presentation/components/AppButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import IconButton from "$lib/presentation/components/IconButton.svelte";
  import { HistoryExportService } from "$lib/services/HistoryExportService";
  import { MatchService } from "$lib/services/MatchService";
  import { MatchHistoryService } from "$lib/services/MatchHistoryService";

  const HISTORY_TABLE_HEADER_PLAYERS = [
    "self",
    "opponent",
    "self",
    "opponent",
    "self",
    "opponent",
    "self",
    "opponent",
    "self",
    "opponent",
  ] as const satisfies readonly ControllablePlayerSnapshot[];
  const GAME_DIALOG_TITLE_ID = "game-dialog-modal-title";
  const GAME_DIALOG_DESCRIPTION_ID = "game-dialog-modal-description";

  let dialog = $state<HTMLDialogElement | undefined>(undefined);
  let previousFocusedElement = $state<HTMLElement | null>(null);
  let turn = $derived(TurnRepository.get());
  let matchControl = $derived(MatchControlRepository.get());
  let dialogState = $derived(GameDialogRepository.get());
  let matchHistory = $derived(MatchHistoryService.getExportData());
  let historyControllers = $derived.by(() => ({
    self: matchHistory.metadata.players.self.controller,
    opponent: matchHistory.metadata.players.opponent.controller,
  }));
  let historyAiStrengths = $derived.by(() => ({
    self: matchHistory.metadata.players.self.aiStrength,
    opponent: matchHistory.metadata.players.opponent.aiStrength,
  }));
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

  function isWinningPlayer(player: ControllablePlayerSnapshot): boolean {
    return matchHistory.metadata.winner === player;
  }

  function historySeatLabel(player: ControllablePlayerSnapshot): string {
    return seatLabel(player);
  }

  function historyDisplayName(player: ControllablePlayerSnapshot): string {
    return playerDisplayName(player, historyControllers, historyAiStrengths);
  }

  function metricValue(
    metricPair: MatchHistoryMetricPair,
    player: ControllablePlayerSnapshot,
  ): number {
    return metricPair[player];
  }

  function isCurrentTurnPlayer(
    turnPlayer: ControllablePlayerSnapshot,
    player: ControllablePlayerSnapshot,
  ): boolean {
    return turnPlayer === player;
  }

  function shouldRenderTurnCell(index: number): boolean {
    const previousEntry = matchHistory.entries[index - 1];
    const currentEntry = matchHistory.entries[index];

    return previousEntry?.capturedAtTurn !== currentEntry?.capturedAtTurn;
  }

  function turnRowSpan(index: number): number {
    const currentEntry = matchHistory.entries[index];
    if (!currentEntry) {
      return 1;
    }

    let rowSpan = 1;
    for (let nextIndex = index + 1; nextIndex < matchHistory.entries.length; nextIndex += 1) {
      if (matchHistory.entries[nextIndex]?.capturedAtTurn !== currentEntry.capturedAtTurn) {
        break;
      }

      rowSpan += 1;
    }

    return rowSpan;
  }

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
    if (isResultDialog && resultSignature !== null) {
      GameDialogRepository.dismissResult(resultSignature);
      return;
    }

    GameDialogRepository.clearLeaveRequest();
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
    GameDialogRepository.reset();
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
  aria-describedby={GAME_DIALOG_DESCRIPTION_ID}
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
          <div class="flex items-center justify-between gap-4">
            <h3 class="text-xl font-semibold">{m.history_title()}</h3>
            <AppButton onclick={downloadHistory}>
              <Icon icon="download" size={18} />
              {m.history_download()}
            </AppButton>
          </div>

          <div class="grid gap-3 overflow-y-auto pr-1">
            <div
              class="border-outline dark:border-outline-dark grid gap-2 rounded-xl border p-4 text-sm sm:grid-cols-2"
            >
              <div
                class="flex items-center gap-2"
                class:text-primary={isWinningPlayer("self")}
                class:dark:text-primary-dark={isWinningPlayer("self")}
              >
                <span class="inline-flex items-center gap-1.5 font-semibold">
                  {#if isWinningPlayer("self")}
                    <Icon icon="emoji_events" size={18} />
                  {/if}
                  {historySeatLabel("self")}
                </span>
                <span class:font-semibold={isWinningPlayer("self")}>
                  {historyDisplayName("self")}
                </span>
              </div>
              <div
                class="flex items-center gap-2"
                class:text-primary={isWinningPlayer("opponent")}
                class:dark:text-primary-dark={isWinningPlayer("opponent")}
              >
                <span class="inline-flex items-center gap-1.5 font-semibold">
                  {#if isWinningPlayer("opponent")}
                    <Icon icon="emoji_events" size={18} />
                  {/if}
                  {historySeatLabel("opponent")}
                </span>
                <span class:font-semibold={isWinningPlayer("opponent")}>
                  {historyDisplayName("opponent")}
                </span>
              </div>
            </div>

            <div class="border-outline dark:border-outline-dark overflow-auto rounded-xl border">
              <table
                class="bg-surface dark:bg-surface-dark w-max min-w-full border-separate border-spacing-0 text-sm"
              >
                <thead
                  class="bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark sticky top-0 z-10"
                >
                  <tr>
                    <th
                      scope="col"
                      rowspan="2"
                      class="border-outline dark:border-outline-dark border-b px-3 py-2 text-center align-middle font-semibold whitespace-nowrap"
                    >
                      <span class="inline-flex h-5 items-center justify-center align-middle">
                        {m.history_turn_label()}
                      </span>
                    </th>
                    <th
                      scope="colgroup"
                      colspan="2"
                      class="border-outline dark:border-outline-dark border-b px-3 py-2 text-center align-middle font-semibold whitespace-nowrap"
                    >
                      <span class="inline-flex h-5 items-center justify-center align-middle">
                        {m.history_turn_player_label()}
                      </span>
                    </th>
                    <th
                      scope="colgroup"
                      colspan="2"
                      class="border-outline dark:border-outline-dark border-b px-3 py-2 text-center align-middle font-semibold whitespace-nowrap"
                    >
                      <span class="inline-flex h-5 items-center justify-center align-middle">
                        {m.unit_count_label()}
                      </span>
                    </th>
                    <th
                      scope="colgroup"
                      colspan="2"
                      class="border-outline dark:border-outline-dark border-b px-3 py-2 text-center align-middle font-semibold whitespace-nowrap"
                      title={m.history_resources_icon_label()}
                    >
                      <span class="inline-flex h-5 items-center justify-center align-middle">
                        <span class="sr-only">{m.history_resources_icon_label()}</span>
                        <Icon icon="home" size={18} />
                      </span>
                    </th>
                    <th
                      scope="colgroup"
                      colspan="2"
                      class="border-outline dark:border-outline-dark border-b px-3 py-2 text-center align-middle font-semibold whitespace-nowrap"
                      title={m.history_wall_icon_label()}
                    >
                      <span class="inline-flex h-5 items-center justify-center align-middle">
                        <span class="sr-only">{m.history_wall_icon_label()}</span>
                        <Icon icon="castle" size={18} />
                      </span>
                    </th>
                    <th
                      scope="colgroup"
                      colspan="2"
                      class="border-outline dark:border-outline-dark border-b px-3 py-2 text-center align-middle font-semibold whitespace-nowrap"
                    >
                      <span class="inline-flex h-5 items-center justify-center align-middle">
                        {m.occupied_panels_label()}
                      </span>
                    </th>
                  </tr>

                  <tr>
                    {#each HISTORY_TABLE_HEADER_PLAYERS as seatHeaderPlayer, seatHeaderIndex (`${seatHeaderPlayer}-${seatHeaderIndex}`)}
                      <th
                        scope="col"
                        class="border-outline/80 dark:border-outline-dark/80 border-b px-3 py-2 text-center align-middle text-xs font-medium whitespace-nowrap"
                      >
                        <span class="inline-flex h-5 items-center justify-center align-middle">
                          {historySeatLabel(seatHeaderPlayer)}
                        </span>
                      </th>
                    {/each}
                  </tr>
                </thead>

                <tbody>
                  {#each matchHistory.entries as entry, index (`${entry.capturedAtTurn}-${entry.turnPlayer}-${index}`)}
                    <tr class="even:bg-surface-container/30 dark:even:bg-surface-container-dark/30">
                      {#if shouldRenderTurnCell(index)}
                        <td
                          rowspan={turnRowSpan(index)}
                          class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center align-middle whitespace-nowrap"
                        >
                          {entry.capturedAtTurn}
                        </td>
                      {/if}
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {#if isCurrentTurnPlayer(entry.turnPlayer, "self")}
                          <span
                            class="inline-flex items-center justify-center"
                            title={m.history_current_turn_marker_label()}
                          >
                            <span class="sr-only">{m.history_current_turn_marker_label()}</span>
                            <Icon icon="task_alt" size={18} />
                          </span>
                        {/if}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {#if isCurrentTurnPlayer(entry.turnPlayer, "opponent")}
                          <span
                            class="inline-flex items-center justify-center"
                            title={m.history_current_turn_marker_label()}
                          >
                            <span class="sr-only">{m.history_current_turn_marker_label()}</span>
                            <Icon icon="task_alt" size={18} />
                          </span>
                        {/if}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.unitTotals, "self")}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.unitTotals, "opponent")}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.resources, "self")}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.resources, "opponent")}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.wallTotals, "self")}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.wallTotals, "opponent")}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.occupiedPanels, "self")}
                      </td>
                      <td
                        class="border-outline/60 dark:border-outline-dark/60 border-b px-3 py-2 text-center whitespace-nowrap"
                      >
                        {metricValue(entry.occupiedPanels, "opponent")}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
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
