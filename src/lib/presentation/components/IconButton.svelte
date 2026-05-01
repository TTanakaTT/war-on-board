<script lang="ts">
  import Icon from "$lib/presentation/components/Icon.svelte";

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
  class="text-onsurface dark:text-onsurface-dark hover:bg-outline dark:hover:bg-outline-dark inline-flex h-8 w-8 items-center justify-center rounded-lg p-1 disabled:cursor-not-allowed disabled:opacity-50 {additionalClass}"
  {onclick}
>
  <Icon {icon} size={24} />
</button>
