<script lang="ts">
  export interface RadioOption {
    value: string;
    label: string;
  }

  interface Props {
    options: RadioOption[];
    value: string;
    onChange: (value: string) => void;
    name: string;
    ariaLabel: string;
    additionalClass?: string;
  }

  let { options, value, onChange, name, ariaLabel, additionalClass = "" }: Props = $props();

  function handleChange(nextValue: string): void {
    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  function optionClass(optionValue: string): string {
    const isSelected = optionValue === value;

    return `border-outline dark:border-outline-dark peer-focus-visible:ring-primary dark:peer-focus-visible:ring-primary-variant-dark shrink-0 border px-4 py-2 text-sm font-medium transition-colors duration-200 ease-in-out peer-focus-visible:ring-2 ${
      isSelected
        ? "bg-primary-variant text-onbackground dark:bg-primary-variant-dark dark:text-onbackground-dark"
        : "bg-surface text-onsurface hover:bg-primary-variant/40 dark:bg-surface-dark dark:text-onsurface-dark dark:hover:bg-primary-variant-dark/40"
    }`;
  }
</script>

<fieldset
  class="inline-flex max-w-full min-w-0 flex-wrap items-start gap-0 border-0 p-0 {additionalClass}"
  aria-label={ariaLabel}
>
  {#each options as option (option.value)}
    <label class="shrink-0 cursor-pointer">
      <input
        class="peer sr-only"
        type="radio"
        {name}
        value={option.value}
        checked={option.value === value}
        onchange={() => handleChange(option.value)}
      />
      <span class={optionClass(option.value)}>
        {option.label}
      </span>
    </label>
  {/each}
</fieldset>
