<script lang="ts">
  import { onMount } from "svelte";
  import { DebugModeRepository } from "$lib/data/repositories/DebugModeRepository";
  import { m } from "$lib/paraglide/messages";
  import { installDebugModeMonitor, violationTypeLabel } from "$lib/presentation/debugMode";

  let reportCount = $derived(DebugModeRepository.getReportCount());
  let latestViolationType = $derived(DebugModeRepository.getLatestViolationType());

  onMount(() => installDebugModeMonitor());
</script>

{#if reportCount > 0 && latestViolationType !== null}
  <div
    role="status"
    class="bg-error text-onerror dark:bg-error-dark dark:text-onerror-dark pointer-events-none fixed right-2 bottom-2 z-50 max-w-[calc(100vw-1rem)] rounded px-2 py-1 text-xs"
  >
    {m.debug_violation_badge({
      count: reportCount,
      type: violationTypeLabel(latestViolationType),
    })}
  </div>
{/if}
