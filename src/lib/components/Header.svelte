<script lang="ts">
	import Menu from 'svelte-material-icons/Menu.svelte';
	let { open, isNav, onClickMenu } = $props();
	let headerWidthStyle = $derived.by(() => {
		if (isNav) {
			return open ? 'ml-64 w-[calc(100%-(var(--spacing)*64))]' : 'w-screen';
		} else {
			return 'w-screen';
		}
	});
</script>

<header
	class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed start-0 top-0 z-20 border-b shadow-md {headerWidthStyle}"
>
	<div class="flex flex-wrap items-center justify-between p-4">
		<button
			type="button"
			class="text-onsurface dark:text-onsurface-dark hover:bg-outline dark:hover:bg-outline-dark inline-flex h-8 w-8 items-center justify-center rounded-lg p-1"
			onclick={onClickMenu}
		>
			<Menu class="size-6" />
		</button>
	</div>
</header>
