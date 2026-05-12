<script lang="ts">
  import Icon from "$lib/presentation/components/primitives/Icon.svelte";

  interface Props {
    icon: string;
    label: string;
    onclick?: () => void;
    disabled?: boolean;
    additionalClass?: string;
  }

  let { icon, label, onclick, disabled = false, additionalClass = "" }: Props = $props();
</script>

<button
  type="button"
  aria-label={label}
  title={label}
  {disabled}
  class="text-onsurface dark:text-onsurface-dark hover:bg-outline dark:hover:bg-outline-dark m-1 inline-flex h-11 w-11 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50 {additionalClass}"
  {onclick}
>
  <Icon {icon} size={24} />
</button>
