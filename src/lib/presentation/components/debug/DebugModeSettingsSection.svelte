<script lang="ts">
  import { DebugModeRepository } from "#lib/store.svelte.ts";
  import HorizontalRadioGroup from "#lib/presentation/components/primitives/HorizontalRadioGroup.svelte";
  import { saveDebugChecksPreference } from "#lib/presentation/debugMode.ts";
  import { DebugModeService } from "#lib/services/DebugModeService.ts";

  const TITLE = "Invariant checks (dev only)";

  let checksEnabled = $derived(DebugModeRepository.isChecksEnabled());

  function handleChange(value: string): void {
    const enabled = value === "on";

    DebugModeService.setChecksEnabled(enabled);
    saveDebugChecksPreference(enabled);
  }
</script>

<section class="flex flex-col gap-3">
  <h2 class="font-semibold tracking-wide uppercase">{TITLE}</h2>
  <HorizontalRadioGroup
    name="settings-debug-checks"
    ariaLabel={TITLE}
    options={[
      { value: "on", label: "On" },
      { value: "off", label: "Off" },
    ]}
    value={checksEnabled ? "on" : "off"}
    onChange={handleChange}
  />
</section>
