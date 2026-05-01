<script lang="ts">
  import { page } from "$app/state";
  import { getLocale, locales, setLocale } from "$lib/paraglide/runtime";
  import { m } from "$lib/paraglide/messages";
  import HorizontalRadioGroup from "$lib/presentation/components/HorizontalRadioGroup.svelte";
  import GameInfoDrawerContent from "$lib/presentation/components/GameInfoDrawerContent.svelte";

  type LocaleValue = (typeof locales)[number];

  let isGamePage = $derived(page.route.id === "/game");
  let selectedLocale = $state<LocaleValue>(getLocale());

  function localeOptions(): { value: LocaleValue; label: string }[] {
    return locales.map((locale) => ({
      value: locale,
      label: locale === "ja" ? m.language_option_japanese() : m.language_option_english(),
    }));
  }

  function handleLocaleChange(locale: string): void {
    const nextLocale = locale as LocaleValue;

    selectedLocale = nextLocale;
    void setLocale(nextLocale);
  }
</script>

{#if isGamePage}
  <div class="flex flex-col gap-6 p-4">
    <div>
      <h1 class="text-xl font-semibold">{m.information_title()}</h1>
    </div>

    <GameInfoDrawerContent />
  </div>
{:else}
  <div class="flex flex-col gap-6 p-4">
    <div>
      <h1 class="text-xl font-semibold">{m.settings_title()}</h1>
    </div>

    <section class="flex flex-col gap-3">
      <h2 class="font-semibold tracking-wide uppercase">{m.language_title()}</h2>
      <HorizontalRadioGroup
        ariaLabel={m.language_title()}
        options={localeOptions()}
        value={selectedLocale}
        onChange={handleLocaleChange}
      />
    </section>
  </div>
{/if}
