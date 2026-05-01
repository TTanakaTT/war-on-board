import { browser } from "$app/environment";

const THEME_STORAGE_KEY = "war-on-board-theme";
const DARK_CLASS_NAME = "dark";
const SYSTEM_DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const themePreferenceValues = ["light", "dark"] as const;

type ThemePreference = (typeof themePreferenceValues)[number];

let systemThemeMediaQuery: MediaQueryList | undefined;
let systemThemeChangeHandler: ((event: MediaQueryListEvent) => void) | undefined;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark";
}

function systemThemePreference(): ThemePreference {
  if (!browser) {
    return "light";
  }

  return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

function storedThemePreference(): ThemePreference | undefined {
  if (!browser) {
    return undefined;
  }

  const themePreference = localStorage.getItem(THEME_STORAGE_KEY);

  return isThemePreference(themePreference) ? themePreference : undefined;
}

function applyThemeToDocument(themePreference: ThemePreference): void {
  document.documentElement.classList.toggle(DARK_CLASS_NAME, themePreference === "dark");
  document.documentElement.style.colorScheme = themePreference;
}

function stopSystemThemeSync(): void {
  if (!systemThemeMediaQuery || !systemThemeChangeHandler) {
    return;
  }

  systemThemeMediaQuery.removeEventListener("change", systemThemeChangeHandler);
  systemThemeMediaQuery = undefined;
  systemThemeChangeHandler = undefined;
}

function startSystemThemeSync(): void {
  if (!browser) {
    return;
  }

  stopSystemThemeSync();

  systemThemeMediaQuery = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);
  systemThemeChangeHandler = (event: MediaQueryListEvent) => {
    applyThemeToDocument(event.matches ? "dark" : "light");
  };

  systemThemeMediaQuery.addEventListener("change", systemThemeChangeHandler);
}

export function resolveThemePreference(): ThemePreference {
  if (!browser) {
    return "light";
  }

  const themePreference = storedThemePreference();

  if (themePreference) {
    return themePreference;
  }

  return systemThemePreference();
}

export function initializeThemePreference(): ThemePreference {
  const themePreference = resolveThemePreference();

  if (browser) {
    if (storedThemePreference()) {
      stopSystemThemeSync();
    } else {
      startSystemThemeSync();
    }

    applyThemeToDocument(themePreference);
  }

  return themePreference;
}

export function setThemePreference(themePreference: ThemePreference): void {
  if (!browser) {
    return;
  }

  stopSystemThemeSync();
  applyThemeToDocument(themePreference);
  localStorage.setItem(THEME_STORAGE_KEY, themePreference);
}

export function clearThemePreference(): void {
  if (!browser) {
    return;
  }

  localStorage.removeItem(THEME_STORAGE_KEY);
  startSystemThemeSync();
  applyThemeToDocument(systemThemePreference());
}
