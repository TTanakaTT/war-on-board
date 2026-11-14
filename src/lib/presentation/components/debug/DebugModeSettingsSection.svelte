<script lang="ts">
  import { DebugModeRepository } from "$lib/data/repositories/DebugModeRepository";
  import { m } from "$lib/paraglide/messages";
  import HorizontalRadioGroup from "$lib/presentation/components/primitives/HorizontalRadioGroup.svelte";
  import { saveDebugChecksPreference } from "$lib/presentation/debugMode";
  import { DebugModeService } from "$lib/services/DebugModeService";

  let checksEnabled = $derived(DebugModeRepository.isChecksEnabled());

  function handleChange(value: string): void {
    const enabled = value === "on";

    DebugModeService.setChecksEnabled(enabled);
    saveDebugChecksPreference(enabled);
  }
</script>

<section class="flex flex-col gap-3">
  <h2 class="font-semibold tracking-wide uppercase">{m.debug_checks_title()}</h2>
  <HorizontalRadioGroup
    name="settings-debug-checks"
    ariaLabel={m.debug_checks_title()}
    options={[
      { value: "on", label: m.debug_checks_on() },
      { value: "off", label: m.debug_checks_off() },
    ]}
    value={checksEnabled ? "on" : "off"}
    onChange={handleChange}
  />
</section>
