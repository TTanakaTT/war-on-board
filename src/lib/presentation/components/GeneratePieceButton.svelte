<script lang="ts">
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { GameService } from "$lib/services/GameService";
  import { TurnRepository } from "$lib/data/repositories/TurnRepository";
  import { Player } from "$lib/domain/enums/Player";
  import { m } from "$lib/paraglide/messages";
  import Icon from "$lib/presentation/components/Icon.svelte";

  let { pieceType }: { pieceType: PieceType } = $props();

  let turn = $derived(TurnRepository.get());
  let currentResources = $derived(turn.resources[String(Player.SELF)] ?? 0);
  let canAfford = $derived(currentResources >= pieceType.config.cost);
  let isPlayerTurn = $derived(turn.player === Player.SELF);
</script>

<button
  type="button"
  class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark flex items-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
  onclick={() => GameService.generate(pieceType)}
  disabled={!canAfford || !isPlayerTurn}
  title={m.piece_cost_tooltip({
    piece: pieceType.config.iconName,
    cost: pieceType.config.cost,
    hp: pieceType.config.maxHp,
    apPiece: pieceType.config.attackPowerAgainstPiece,
    apWall: pieceType.config.attackPowerAgainstWall,
  })}
>
  <Icon icon={pieceType.config.iconName} size={20} />
  <span>{m.produce()}</span>
</button>
