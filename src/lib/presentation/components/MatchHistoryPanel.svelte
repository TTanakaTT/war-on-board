<script lang="ts">
  import type { MatchHistoryExport } from "$lib/domain/types/history";
  import type { ControllablePlayerSnapshot } from "$lib/domain/types/api";
  import { m } from "$lib/paraglide/messages";
  import { playerDisplayName, seatLabel } from "$lib/presentation/matchPresentation";
  import AppButton from "$lib/presentation/components/AppButton.svelte";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import MatchHistoryTable from "$lib/presentation/components/MatchHistoryTable.svelte";

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

  <MatchHistoryTable {matchHistory} />
</div>
