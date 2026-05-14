<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import AppDrawer from "$lib/presentation/components/shell/AppDrawer.svelte";
  import AppHeader from "$lib/presentation/components/shell/AppHeader.svelte";
  import {
    DEFAULT_DRAWER_WIDTH_UNITS,
    DESKTOP_NAVIGATION_BREAKPOINT_PX,
    DRAWER_WIDTH_TRANSITION_MS,
    EXPANDED_GAME_DRAWER_WIDTH_UNITS,
  } from "$lib/presentation/constants/UiConstants";
  import { initializeThemePreference } from "$lib/presentation/themePreference";
  import { tick } from "svelte";
  import type { Snippet } from "svelte";

  const GAME_DRAWER_EXPANDED_STORAGE_KEY = "war-on-board-game-drawer-expanded";

  let { children }: { children: Snippet } = $props();
  let open = $state(false);
  let dialog = $state<HTMLDialogElement | undefined>(undefined);
  let windowWidth = $state(0);
  let isNav = $derived(windowWidth > DESKTOP_NAVIGATION_BREAKPOINT_PX);
  let routeId = $derived(page.route.id ?? "/");
  let isGamePage = $derived(routeId === "/game");
  let mainTopPaddingClass = $derived(isGamePage ? "pt-32 lg:pt-16" : "pt-16");
  let isGameDrawerExpanded = $state(false);
  let isWideGameDrawerLayout = $state(false);
  let hasLoadedGameDrawerPreference = $state(false);
  let isGameDrawerTransitioning = $state(false);
  let drawerWidthUnits = $derived(
    isNav && isGamePage && isGameDrawerExpanded
      ? EXPANDED_GAME_DRAWER_WIDTH_UNITS
      : DEFAULT_DRAWER_WIDTH_UNITS,
  );

  let mainPaddingStyle = $derived.by(() => {
    if (!isNav || !open) {
      return "";
    }

    return `padding-left: calc(var(--spacing) * ${drawerWidthUnits});`;
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

  function clearGameDrawerTransition(): void {
    isGameDrawerTransitioning = false;
  }

  async function toggleGameDrawerExpansion(): Promise<void> {
    if (!isNav || !isGamePage || isGameDrawerTransitioning) {
      return;
    }

    isGameDrawerTransitioning = true;

    if (isGameDrawerExpanded) {
      isWideGameDrawerLayout = false;
      await tick();

      requestAnimationFrame(() => {
        isGameDrawerExpanded = false;

        window.setTimeout(() => {
          clearGameDrawerTransition();
        }, DRAWER_WIDTH_TRANSITION_MS);
      });

      return;
    }

    isGameDrawerExpanded = true;

    window.setTimeout(() => {
      if (isNav && isGamePage && isGameDrawerExpanded) {
        isWideGameDrawerLayout = true;
      }

      clearGameDrawerTransition();
    }, DRAWER_WIDTH_TRANSITION_MS);
  }

  $effect(() => {
    if (!browser) {
      return;
    }

    const savedExpanded = localStorage.getItem(GAME_DRAWER_EXPANDED_STORAGE_KEY) === "true";

    isGameDrawerExpanded = savedExpanded;
    isWideGameDrawerLayout = savedExpanded && isNav && isGamePage;
    hasLoadedGameDrawerPreference = true;
  });

  $effect(() => {
    if (!browser || !hasLoadedGameDrawerPreference) {
      return;
    }

    localStorage.setItem(GAME_DRAWER_EXPANDED_STORAGE_KEY, String(isGameDrawerExpanded));
  });

  $effect(() => {
    const desktopNav = isNav;
    const gamePage = isGamePage;
    const expanded = isGameDrawerExpanded;
    const transitioning = isGameDrawerTransitioning;

    if (!desktopNav || !gamePage) {
      isWideGameDrawerLayout = false;
      return;
    }

    if (!transitioning && expanded) {
      isWideGameDrawerLayout = true;
    }
  });

  $effect(() => {
    const currentRouteId = routeId;
    const desktopNav = isNav;

    if (!currentRouteId) {
      return;
    }

    open = desktopNav;

    if (dialog?.open) {
      dialog.close();
    }
  });

  $effect(() => {
    initializeThemePreference();
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

<AppDrawer
  {open}
  {isNav}
  {isGamePage}
  {isGameDrawerExpanded}
  {isWideGameDrawerLayout}
  {drawerWidthUnits}
  {onClickDialog}
  onToggleGameDrawerExpansion={toggleGameDrawerExpansion}
  bind:dialog
/>

<AppHeader {open} {isNav} {onClickMenu} {drawerWidthUnits} />

<main
  class="h-screen touch-pan-y transition-[padding-left] duration-200 ease-out {mainTopPaddingClass}"
  style={mainPaddingStyle}
>
  {@render children()}
</main>
