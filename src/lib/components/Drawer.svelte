<script lang="ts">
	import { locales, setLocale } from '$lib/paraglide/runtime';
	let { dialog = $bindable(), open, isNav, onClickDialog } = $props();
	let navTranslateStyle = $derived(open ? 'translate-x-0' : '-translate-x-full');
</script>

{#if isNav}
	<nav
		class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark text-onsurface dark:text-onsurface-dark fixed z-1000 h-screen w-64 overflow-hidden border transition duration-200 ease-out {navTranslateStyle}"
	>
		<div>
			<h1>Drawer</h1>
			{#each locales as locale (locale)}
				<button
					class="border-primary dark:border-primary-dark hover:ring-primary dark:hover:ring-primary-dark m-1 rounded-xl border p-1 hover:ring"
					onclick={() => setLocale(locale)}>{locale}</button
				>
			{/each}
		</div>
	</nav>
{:else}
	<dialog bind:this={dialog} onclick={onClickDialog}>
		<div
			class="dialog-content bg-surface dark:bg-surface-dark text-onsurface dark:text-onsurface-dark border-outline dark:border-outline-dark fixed h-screen w-64 overflow-hidden border transition duration-200 ease-out {navTranslateStyle}"
		>
			<h1>Drawer</h1>
			{#each locales as locale (locale)}
				<button
					class="border-primary dark:border-primary-dark hover:ring-primary dark:hover:ring-primary-dark m-1 rounded-xl border p-1 hover:ring"
					onclick={() => setLocale(locale)}>{locale}</button
				>
			{/each}
		</div>
	</dialog>
{/if}
