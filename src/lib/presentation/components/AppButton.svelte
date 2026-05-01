<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    fullWidth?: boolean;
    onclick?: () => void;
    additionalClass?: string;
    children?: Snippet;
  }

  let {
    type = "button",
    disabled = false,
    fullWidth = false,
    onclick,
    additionalClass = "",
    children,
  }: Props = $props();

  let widthClass = $derived(fullWidth ? "w-full" : "");
</script>

<button
  {type}
  {disabled}
  class="border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark inline-flex items-center justify-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 {widthClass} {additionalClass}"
  {onclick}
>
  {@render children?.()}
</button>
