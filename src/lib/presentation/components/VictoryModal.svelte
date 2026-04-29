<script lang="ts">
  import { GameStateHistoryRepository } from "$lib/data/repositories/GameStateHistoryRepository";
  import { MatchControlRepository } from "$lib/data/repositories/MatchControlRepository";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import type { GameStateHistoryEntry, PlayerSnapshot } from "$lib/domain/types/api";
  import * as m from "$lib/paraglide/messages/_index.js";
  import { HistoryExportService } from "$lib/services/HistoryExportService";

  let turn = $derived(TurnRepository.get());
  let matchControl = $derived(MatchControlRepository.get());
  let historyEntries = $derived(GameStateHistoryRepository.getAll());
  let isVictory = $derived(turn.winner === Player.SELF);
  let isDefeat = $derived(turn.winner === Player.OPPONENT);
  let isCpuMatch = $derived(matchControl.mode === "cpu-vs-cpu");
  let isAutomationStopped = $derived(
    turn.winner === null &&
      matchControl.automation.status === "stopped" &&
      matchControl.automation.stopReason !== null,
  );
  let showModal = $derived(turn.winner !== null || isAutomationStopped);

  function playerLabel(player: Player | PlayerSnapshot | null): string {
    if (player === Player.SELF || player === "self") {
      return matchControl.mode === "cpu-vs-cpu" ? m.cpu_one() : m.player_self();
    }
    if (player === Player.OPPONENT || player === "opponent") {
      return matchControl.mode === "cpu-vs-cpu" ? m.cpu_two() : m.player_opponent();
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
    if (player === "self") {
      return matchControl.mode === "cpu-vs-cpu" ? m.cpu_one() : m.player_self();
    }

    return matchControl.mode === "cpu-vs-cpu" ? m.cpu_two() : m.player_opponent();
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
</script>

{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
    <div
      class="bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark flex max-h-[85vh] max-w-3xl min-w-72 flex-col gap-6 overflow-hidden rounded-2xl p-8 shadow-2xl"
    >
      <div class="flex flex-col items-center gap-4 text-center">
        {#if isAutomationStopped}
          <span class="material-symbols-outlined text-warning text-6xl">timer_off</span>
          <h2 class="text-3xl font-bold">{m.automation_stopped_title()}</h2>
          <p class="text-lg">
            {m.automation_turn_limit_message({ turnLimit: matchControl.automation.turnLimit })}
          </p>
        {:else if isCpuMatch}
          <span class="material-symbols-outlined text-primary dark:text-primary-dark text-6xl">
            smart_toy
          </span>
          <h2 class="text-primary dark:text-primary-dark text-3xl font-bold">
            {m.match_finished_title()}
          </h2>
          <p class="text-lg">
            {m.cpu_match_finished_message({ winner: playerLabel(turn.winner) })}
          </p>
        {:else if isVictory}
          <span class="material-symbols-outlined text-primary dark:text-primary-dark text-6xl">
            emoji_events
          </span>
          <h2 class="text-primary dark:text-primary-dark text-3xl font-bold">
            {m.victory_title()}
          </h2>
          <p class="text-lg">
            {m.victory_message()}
          </p>
        {:else if isDefeat}
          <span class="material-symbols-outlined text-error dark:text-error-dark text-6xl">
            heart_broken
          </span>
          <h2 class="text-error dark:text-error-dark text-3xl font-bold">
            {m.defeat_title()}
          </h2>
          <p class="text-lg">
            {m.defeat_message()}
          </p>
        {/if}
      </div>

      <div class="flex items-center justify-between gap-4">
        <h3 class="text-xl font-semibold">{m.history_title()}</h3>
        <button
          type="button"
          class="border-primary dark:border-primary-dark hover:ring-primary dark:hover:ring-primary-dark flex items-center gap-2 rounded-xl border px-3 py-2 transition hover:ring"
          onclick={downloadHistory}
        >
          <span class="material-symbols-outlined text-base">download</span>
          {m.history_download()}
        </button>
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
    </div>
  </div>
{/if}
