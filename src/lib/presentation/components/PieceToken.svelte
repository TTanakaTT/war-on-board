<script lang="ts">
  import type { Piece } from "$lib/domain/entities/Piece";
  import { Player } from "$lib/domain/enums/Player";
  import Icon from "$lib/presentation/components/Icon.svelte";
  import { slide } from "svelte/transition";

  interface Props {
    piece: Piece;
  }

  let { piece }: Props = $props();

  let pieceColorClass = $derived(
    piece.player === Player.SELF
      ? "text-player-self border-player-self"
      : "text-player-opponent border-player-opponent",
  );
  let stackBadgeClass = $derived(
    piece.player === Player.SELF
      ? "bg-player-self text-player-opponent"
      : "bg-player-opponent text-player-self",
  );
</script>

<div class="relative flex flex-col items-center">
  <div class="bg-outline dark:bg-outline-dark mb-1 h-1 w-6 overflow-hidden rounded-full">
    <div
      class="bg-health-fill h-full transition-all duration-300"
      style="width: {(piece.hp / piece.maxHp) * 100}%"
    ></div>
  </div>

  <div class="relative">
    <Icon
      icon={piece.pieceType.config.iconName}
      size={22}
      transition={slide}
      transitionParams={{ duration: 500, axis: "y" }}
      additionalClass="bg-primary-variant dark:bg-primary-variant-dark rounded-xl border p-1 {pieceColorClass}"
    />

    {#if piece.stackCount > 1}
      <span
        class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] leading-none font-bold {stackBadgeClass}"
      >
        {piece.stackCount}
      </span>
    {/if}
  </div>
</div>
