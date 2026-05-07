<script lang="ts">
  import Icon from "$lib/presentation/components/Icon.svelte";

  interface Props {
    expanded: boolean;
    onclick?: () => void;
  }

  let { expanded, onclick }: Props = $props();

  let icon = $derived(expanded ? "keyboard_arrow_left" : "keyboard_arrow_right");
</script>

<button
  type="button"
  class="bg-background dark:bg-background-dark border-outline dark:border-outline-dark text-onsurface dark:text-onsurface-dark hover:bg-surface dark:hover:bg-surface-dark inline-flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-200"
  {onclick}
>
  <Icon {icon} size={24} />
</button>
