<script lang="ts">
  import { DebugModeRepository } from "$lib/data/repositories/DebugModeRepository";
  import HorizontalRadioGroup from "$lib/presentation/components/primitives/HorizontalRadioGroup.svelte";
  import { saveDebugChecksPreference } from "$lib/presentation/debugMode";
  import { DebugModeService } from "$lib/services/DebugModeService";

  // Dev-build-only text: English literals on purpose, not Paraglide messages (see CLAUDE.md).
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
