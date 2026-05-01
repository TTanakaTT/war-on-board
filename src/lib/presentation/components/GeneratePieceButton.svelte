<script lang="ts">
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { GameApi } from "$lib/api/GameApi";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { m } from "$lib/paraglide/messages";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import { MatchService } from "$lib/services/MatchService";

  let { pieceType }: { pieceType: PieceType } = $props();

  let turn = $derived(TurnRepository.get());
  let actingPlayer = $derived(turn.player);
  let currentResources = $derived(turn.resources[String(actingPlayer)] ?? 0);
  let canAfford = $derived(currentResources >= pieceType.config.cost);
  let isHumanTurn = $derived(MatchService.getControllerForCurrentTurn() === "human");
  let isAutomationRunning = $derived(MatchService.isAutomationRunning());

  function pieceLabel(piece: PieceType): string {
    if (piece === PieceType.KNIGHT) {
      return m.piece_knight();
    }

    if (piece === PieceType.ROOK) {
      return m.piece_rook();
    }

    return m.piece_bishop();
  }
</script>

<button
  type="button"
  class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark flex items-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
  onclick={() => GameApi.generatePiece(actingPlayer, pieceType)}
  disabled={!canAfford || !isHumanTurn || isAutomationRunning || turn.winner !== null}
  title={m.piece_cost_tooltip({
    piece: pieceLabel(pieceType),
    cost: pieceType.config.cost,
    hp: pieceType.config.maxHp,
    apPiece: pieceType.config.attackPowerAgainstPiece,
    apWall: pieceType.config.attackPowerAgainstWall,
  })}
>
  <Icon icon={pieceType.config.iconName} size={20} />
  <span>{pieceLabel(pieceType)}</span>
</button>
