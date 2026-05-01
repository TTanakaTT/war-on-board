<script lang="ts">
  import DrawerContent from "$lib/presentation/components/DrawerContent.svelte";
  let {
    dialog = $bindable(),
    open,
    isNav,
    onClickDialog,
  }: {
    dialog?: HTMLDialogElement;
    open: boolean;
    isNav: boolean;
    onClickDialog: (event: MouseEvent) => void;
  } = $props();
  let navTranslateStyle = $derived(open ? "translate-x-0" : "-translate-x-full");
</script>

{#if isNav}
  <nav
    class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark text-onsurface dark:text-onsurface-dark fixed z-1000 h-screen w-64 overflow-hidden border transition duration-200 ease-out {navTranslateStyle}"
  >
    <DrawerContent />
  </nav>
{:else}
  <dialog bind:this={dialog} onclick={onClickDialog}>
    <div
      class="dialog-content bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark border-outline dark:border-outline-dark fixed h-screen w-64 overflow-hidden border transition duration-200 ease-out {navTranslateStyle}"
    >
      <DrawerContent />
    </div>
  </dialog>
{/if}
