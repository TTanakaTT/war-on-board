<script lang="ts">
  import { PieceType } from "$lib/domain/enums/PieceType";
  import { GameService } from "$lib/services/GameService";
  import { m } from "$lib/paraglide/messages";

  let { pieceType }: { pieceType: PieceType } = $props();
</script>

<button
  type="button"
  class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none"
  onclick={() => GameService.generate(pieceType)}
>
  {m.generate_piece({ piece: pieceType })}
</button>
