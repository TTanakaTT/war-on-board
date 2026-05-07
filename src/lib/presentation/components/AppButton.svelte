<script lang="ts">
  import type { Snippet } from "svelte";

  const buttonVariants = {
    primary:
      "border-primary dark:border-primary-dark text-onbackground dark:text-onbackground-dark shadow-primary dark:shadow-primary-dark hover:ring-primary dark:hover:ring-primary-dark",
    error:
      "border-error dark:border-error-dark text-onbackground dark:text-onbackground-dark shadow-error dark:shadow-error-dark hover:ring-error dark:hover:ring-error-dark",
  } as const;

  type ButtonVariant = keyof typeof buttonVariants;

  interface Props {
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    variant?: ButtonVariant;
    onclick?: () => void;
    additionalClass?: string;
    children?: Snippet;
  }

  let {
    type = "button",
    disabled = false,
    variant = "primary",
    onclick,
    additionalClass = "",
    children,
  }: Props = $props();

  let variantClass = $derived(buttonVariants[variant]);
</script>

<button
  {type}
  {disabled}
  class="mt-0.5 mb-2 inline-flex items-center justify-center gap-2 rounded-3xl border px-5 py-2.5 shadow-md transition-all duration-200 ease-in-out hover:ring active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 {variantClass} {additionalClass}"
  {onclick}
>
  {@render children?.()}
</button>
