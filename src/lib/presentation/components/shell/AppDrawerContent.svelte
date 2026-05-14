<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { cookieDomain, cookieName, getLocale, locales, setLocale } from "$lib/paraglide/runtime";
  import { m } from "$lib/paraglide/messages";
  import AppButton from "$lib/presentation/components/primitives/AppButton.svelte";
  import HorizontalRadioGroup from "$lib/presentation/components/primitives/HorizontalRadioGroup.svelte";
  import GameInfoDrawerContent from "$lib/presentation/components/match/GameInfoDrawerContent.svelte";
  import {
    clearThemePreference,
    resolveThemePreference,
    setThemePreference,
    themePreferenceValues,
  } from "$lib/presentation/themePreference";

  type LocaleValue = (typeof locales)[number];
  type ThemePreference = (typeof themePreferenceValues)[number];

  interface Props {
    isWideGameLayout?: boolean;
    isBrowserLayout?: boolean;
  }

  let { isWideGameLayout = false, isBrowserLayout = false }: Props = $props();

  let isGamePage = $derived(page.route.id === "/game");
  let selectedLocale = $state<LocaleValue>(getLocale());
  let selectedTheme = $state<ThemePreference>("light");

  onMount(() => {
    selectedTheme = resolveThemePreference();
  });

  function localeOptions(): { value: LocaleValue; label: string }[] {
    return locales.map((locale) => ({
      value: locale,
      label: locale === "ja" ? "日本語" : "English",
    }));
  }

  function themeOptions(): { value: ThemePreference; label: string }[] {
    return [
      { value: "light", label: m.theme_option_light() },
      { value: "dark", label: m.theme_option_dark() },
    ];
  }

  function handleLocaleChange(locale: string): void {
    const nextLocale = locale as LocaleValue;

    selectedLocale = nextLocale;
    void setLocale(nextLocale);
  }

  function handleThemeChange(themePreference: string): void {
    const nextThemePreference = themePreference as ThemePreference;

    selectedTheme = nextThemePreference;
    setThemePreference(nextThemePreference);
  }

  function resetSettings(): void {
    clearThemePreference();
    selectedTheme = resolveThemePreference();

    const cookieString = `${cookieName}=; path=/; max-age=0`;
    document.cookie = cookieDomain ? `${cookieString}; domain=${cookieDomain}` : cookieString;
    window.location.reload();
  }
</script>

{#if isGamePage}
  <div class="no-scrollbar flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-4">
    <div>
      <h1 class="text-xl font-semibold">{m.information_title()}</h1>
    </div>

    <GameInfoDrawerContent isWideLayout={isWideGameLayout} {isBrowserLayout} />
  </div>
{:else}
  <div class="no-scrollbar flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-4">
    <div>
      <h1 class="text-xl font-semibold">{m.settings_title()}</h1>
    </div>

    <section class="flex flex-col gap-3">
      <h2 class="font-semibold tracking-wide uppercase">{m.language_title()}</h2>
      <HorizontalRadioGroup
        name="settings-language"
        ariaLabel={m.language_title()}
        options={localeOptions()}
        value={selectedLocale}
        onChange={handleLocaleChange}
      />
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="font-semibold tracking-wide uppercase">{m.theme_title()}</h2>
      <HorizontalRadioGroup
        name="settings-theme"
        ariaLabel={m.theme_title()}
        options={themeOptions()}
        value={selectedTheme}
        onChange={handleThemeChange}
      />
    </section>

    <AppButton additionalClass="self-center" variant="error" onclick={resetSettings}>
      {m.settings_reset()}
    </AppButton>
  </div>
{/if}
