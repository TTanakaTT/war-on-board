<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { GameDialogRepository } from "$lib/data/repositories/GameDialogRepository";
  import { GameStateHistoryRepository } from "$lib/data/repositories/GameStateHistoryRepository";
  import { LayerRepository } from "$lib/data/repositories/LayerRepository";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import type { GameStateHistoryEntry, PlayerSnapshot } from "$lib/domain/types/api";
  import { m } from "$lib/paraglide/messages";
  import AppButton from "$lib/presentation/components/AppButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import IconButton from "$lib/presentation/components/IconButton.svelte";
  import { playerDisplayName, playerSlotSummary } from "$lib/presentation/matchPresentation";
  import { HistoryExportService } from "$lib/services/HistoryExportService";
  import { MatchService } from "$lib/services/MatchService";

  let turn = $derived(TurnRepository.get());
  let matchControl = $derived(MatchControlRepository.get());
  let dialogState = $derived(GameDialogRepository.get());
  let historyEntries = $derived(GameStateHistoryRepository.getAll());
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

  function playerLabel(player: Player | PlayerSnapshot | null): string {
    if (
      player === Player.SELF ||
      player === "self" ||
      player === Player.OPPONENT ||
      player === "opponent"
    ) {
      return playerDisplayName(player, matchControl.controllers, matchControl.aiStrengths);
    }

    return "-";
  }

  function playerSummary(player: Player | PlayerSnapshot | null): string {
    if (
      player === Player.SELF ||
      player === "self" ||
      player === Player.OPPONENT ||
      player === "opponent"
    ) {
      return playerSlotSummary(player, matchControl.controllers, matchControl.aiStrengths);
    }

    return "-";
  }

  function pieceCount(entry: GameStateHistoryEntry, player: PlayerSnapshot): number {
    return entry.snapshot.pieces.filter((piece) => piece.player === player).length;
  }

  function resources(entry: GameStateHistoryEntry, player: PlayerSnapshot): number {
    return entry.snapshot.turn.resources[player] ?? 0;
  }

  function snapshotPlayerLabel(player: PlayerSnapshot): string {
    return playerLabel(player);
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
</script>

{#if showModal}
  <div class="fixed inset-0 z-2000 flex items-center justify-center bg-black/60 px-4">
    <div
      class="bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark flex max-h-[85vh] flex-col gap-6 overflow-hidden rounded-2xl p-4 shadow-2xl {dialogWidthClass}"
    >
      <div class="grid min-h-8 grid-cols-[3rem_auto_3rem] items-center justify-center gap-3">
        <div aria-hidden="true"></div>

        <h2 class="text-center text-2xl leading-none font-bold">
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
      {:else if turn.winner !== null}
        <div class="text-center text-lg">
          {m.result_winner_message({ winner: playerSummary(turn.winner) })}
        </div>
      {/if}

      {#if isResultDialog}
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-xl font-semibold">{m.history_title()}</h3>
          <AppButton additionalClass="rounded-xl px-3 py-2" onclick={downloadHistory}>
            <Icon icon="download" size={18} />
            {m.history_download()}
          </AppButton>
        </div>

        <div class="grid gap-3 overflow-y-auto pr-1">
          {#each historyEntries as entry (entry.sequence)}
            <article class="border-outline dark:border-outline-dark rounded-xl border p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="text-sm font-semibold">
                  {m.history_sequence_label()}
                  {entry.sequence}
                </div>
                <div class="text-sm">
                  {m.history_turn_label()}
                  {entry.capturedAtTurn}
                </div>
              </div>

              <div class="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <span class="font-semibold">{m.history_winner_label()}</span>
                  <span class="ml-2">{playerLabel(entry.snapshot.turn.winner)}</span>
                </div>
                <div>
                  <span class="font-semibold">{m.history_pieces_label()}</span>
                  <span class="ml-2"
                    >{snapshotPlayerLabel("self")}
                    {pieceCount(entry, "self")} / {snapshotPlayerLabel("opponent")}
                    {pieceCount(entry, "opponent")}</span
                  >
                </div>
                <div>
                  <span class="font-semibold">{m.history_resources_label()}</span>
                  <span class="ml-2"
                    >{snapshotPlayerLabel("self")}
                    {resources(entry, "self")} / {snapshotPlayerLabel("opponent")}
                    {resources(entry, "opponent")}</span
                  >
                </div>
              </div>
            </article>
          {/each}
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
