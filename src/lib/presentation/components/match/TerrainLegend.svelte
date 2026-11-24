<script lang="ts">
  import { terrainConfig, type Terrain } from "#lib/domain/model.ts";
  import { m } from "#lib/paraglide/messages.js";
  import Icon from "#lib/presentation/components/primitives/Icon.svelte";
  import { legendTerrains } from "#lib/presentation/labels.ts";
  import { LEGEND_ICON_SIZE_PX } from "#lib/presentation/layout.ts";
  import { terrainIconClass } from "#lib/presentation/terrain.ts";

  const iconName = (terrain: Terrain) => terrainConfig(terrain).iconName ?? "";
</script>

<section class="flex flex-col gap-3">
  <h2 class="font-semibold">{m.terrain_legend_title()}</h2>
  <dl class="grid gap-2 text-sm">
    {#each legendTerrains as { terrain, name, description } (terrain)}
      <div class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2">
        <dt class="row-span-2 {terrainIconClass(terrain)}">
          <Icon icon={iconName(terrain)} size={LEGEND_ICON_SIZE_PX} />
        </dt>
        <dt class="font-semibold">{name()}</dt>
        <dd>{description()}</dd>
      </div>
    {/each}
  </dl>
</section>
