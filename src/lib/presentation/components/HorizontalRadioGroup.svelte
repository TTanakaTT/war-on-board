<script lang="ts">
  export interface RadioOption {
    value: string;
    label: string;
  }

  interface Props {
    options: RadioOption[];
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    additionalClass?: string;
  }

  let { options, value, onChange, ariaLabel, additionalClass = "" }: Props = $props();

  function optionClass(optionValue: string): string {
    const isSelected = optionValue === value;

    return `shrink-0 border-outline dark:border-outline-dark border px-4 py-2 text-sm font-medium transition-colors duration-200 ease-in-out ${
      isSelected
        ? "bg-primary-variant text-onbackground dark:bg-primary-variant-dark dark:text-onbackground-dark"
        : "bg-surface text-onsurface hover:bg-primary-variant/40 dark:bg-surface-dark dark:text-onsurface-dark dark:hover:bg-primary-variant-dark/40"
    }`;
  }
</script>

<div
  class="inline-flex max-w-full min-w-0 flex-wrap items-start gap-0 {additionalClass}"
  role="radiogroup"
  aria-label={ariaLabel}
>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      class={optionClass(option.value)}
      onclick={() => onChange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
