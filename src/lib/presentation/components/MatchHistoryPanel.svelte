<script lang="ts">
  import type { MatchHistoryExport, MatchHistoryMetricPair } from "$lib/domain/types/history";
  import type { ControllablePlayerSnapshot } from "$lib/domain/types/api";
  import { m } from "$lib/paraglide/messages";
  import { playerDisplayName, seatLabel } from "$lib/presentation/matchPresentation";
  import AppButton from "$lib/presentation/components/AppButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";

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

  let {
    matchHistory,
    onDownloadHistory,
  }: {
    matchHistory: MatchHistoryExport;
    onDownloadHistory: () => void;
  } = $props();

  let historyControllers = $derived.by(() => ({
    self: matchHistory.metadata.players.self.controller,
    opponent: matchHistory.metadata.players.opponent.controller,
  }));
  let historyAiStrengths = $derived.by(() => ({
    self: matchHistory.metadata.players.self.aiStrength,
    opponent: matchHistory.metadata.players.opponent.aiStrength,
  }));

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
</script>

<div class="flex items-center justify-between gap-4">
  <h3 class="text-xl font-semibold">{m.history_title()}</h3>
  <AppButton onclick={onDownloadHistory}>
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
