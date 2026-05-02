<script lang="ts">
  import DrawerContent from "$lib/presentation/components/DrawerContent.svelte";
  import DrawerEdgeToggleButton from "$lib/presentation/components/DrawerEdgeToggleButton.svelte";
  let {
    dialog = $bindable(),
    open,
    isNav,
    isGamePage,
    isGameDrawerExpanded,
    isWideGameDrawerLayout,
    drawerWidthUnits,
    onClickDialog,
    onToggleGameDrawerExpansion,
  }: {
    dialog?: HTMLDialogElement;
    open: boolean;
    isNav: boolean;
    isGamePage: boolean;
    isGameDrawerExpanded: boolean;
    isWideGameDrawerLayout: boolean;
    drawerWidthUnits: number;
    onClickDialog: (event: MouseEvent) => void;
    onToggleGameDrawerExpansion: () => void;
  } = $props();
  let navTranslateStyle = $derived(open ? "translate-x-0" : "-translate-x-full");
  let drawerWidthStyle = $derived(`width: calc(var(--spacing) * ${drawerWidthUnits});`);
</script>

{#if isNav}
  <nav
    class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark text-onsurface dark:text-onsurface-dark fixed z-1000 h-screen border transition-[width,transform] duration-200 ease-out {navTranslateStyle}"
    style={drawerWidthStyle}
  >
    <div class="relative h-full">
      <div class="h-full overflow-hidden {isGamePage && open ? 'pr-5' : ''}">
        <DrawerContent isWideGameLayout={isWideGameDrawerLayout} />
      </div>

      {#if isGamePage && open}
        <div
          class="pointer-events-none absolute top-1/2 right-0 z-10 translate-x-1/2 -translate-y-1/2"
        >
          <div class="pointer-events-auto">
            <DrawerEdgeToggleButton
              expanded={isGameDrawerExpanded}
              onclick={onToggleGameDrawerExpansion}
            />
          </div>
        </div>
      {/if}
    </div>
  </nav>
{:else}
  <dialog bind:this={dialog} onclick={onClickDialog}>
    <div
      class="dialog-content bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark border-outline dark:border-outline-dark fixed h-screen overflow-hidden border transition-transform duration-200 ease-out {navTranslateStyle}"
      style={drawerWidthStyle}
    >
      <DrawerContent />
    </div>
  </dialog>
{/if}
