<script lang="ts">
  import Icon from "$lib/presentation/components/Icon.svelte";
  let {
    open,
    isNav,
    onClickMenu,
  }: {
    open: boolean;
    isNav: boolean;
    onClickMenu: () => void;
  } = $props();
  let headerWidthStyle = $derived.by(() => {
    if (isNav) {
      return open ? "ml-64 w-[calc(100%-(var(--spacing)*64))]" : "w-screen";
    } else {
      return "w-screen";
    }
  });
</script>

<header
  class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed start-0 top-0 z-20 border-b shadow-md {headerWidthStyle}"
>
  <div class="flex flex-wrap items-center justify-between p-4">
    <button
      type="button"
      class="text-onsurface dark:text-onsurface-dark hover:bg-outline dark:hover:bg-outline-dark inline-flex h-8 w-8 items-center justify-center rounded-lg p-1"
      onclick={onClickMenu}
    >
      <Icon icon="menu" size={24} />
    </button>
  </div>
</header>
