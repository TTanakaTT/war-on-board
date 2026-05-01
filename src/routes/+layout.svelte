<script lang="ts">
  import "../app.css";
  import { page } from "$app/state";
  import Header from "$lib/presentation/components/Header.svelte";
  import Drawer from "$lib/presentation/components/Drawer.svelte";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
  let open = $state(false);
  let dialog = $state<HTMLDialogElement | undefined>(undefined);
  let windowWidth = $state(0);
  let isNav = $derived(windowWidth > 1024);
  let routeId = $derived(page.route.id ?? "/");

  let mainPaddingStyle = $derived.by(() => {
    if (isNav) {
      return open ? "pl-64" : "pl-0";
    } else {
      return "pl-0";
    }
  });

  function onClickDialog(event: MouseEvent): void {
    if (event.target === dialog) {
      open = false;

      setTimeout(
        () => {
          if (dialog) dialog.close();
        },
        200, // wait for the dialog transition to finish closing
      );
    }
  }

  function onClickMenu(): void {
    if (isNav) {
      open = !open;
    } else if (dialog) {
      dialog.showModal();
      open = true;
    }
  }

  $effect(() => {
    const currentRouteId = routeId;

    if (!currentRouteId) {
      return;
    }

    open = false;
    if (dialog?.open) {
      dialog.close();
    }
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

<Drawer {open} {isNav} {onClickDialog} bind:dialog />

<Header {open} {isNav} {onClickMenu} />

<main class="h-screen pt-16 {mainPaddingStyle}">{@render children()}</main>
