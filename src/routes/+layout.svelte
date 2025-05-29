<script lang="ts">
	import '../app.css';
	import Menu from 'svelte-material-icons/Menu.svelte';
	import { locales, setLocale } from '$lib/paraglide/runtime';

	let { children } = $props();
	let open = $state(false);
	let dialog = $state<HTMLDialogElement | undefined>(undefined);

	let windowWidth = $state(0);
	let isNav = $derived(windowWidth > 1024);
	let navTranslateStyle = $derived(open ? 'translate-x-0' : '-translate-x-full');
	let headerWidthStyle = $derived.by(() => {
		if (isNav) {
			return open ? 'ml-64 w-[calc(100%-(var(--spacing)*64))]' : 'w-screen';
		} else {
			return 'w-screen';
		}
	});
	let mainPaddingStyle = $derived.by(() => {
		if (isNav) {
			return open ? 'pl-64' : 'pl-0';
		} else {
			return 'pl-0';
		}
	});

	function clickDialog(event: MouseEvent): void {
		if (event.target === dialog) {
			open = false;
			setTimeout(
				() => {
					if (dialog) dialog.close();
				},
				200 // wait for the dialog transition to finish closing
			);
		}
	}
</script>

<svelte:window bind:innerWidth={windowWidth} />

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
	<dialog bind:this={dialog} onclick={clickDialog}>
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
<header
	class="bg-surface dark:bg-surface-dark border-outline dark:border-outline-dark fixed start-0 top-0 z-20 border-b shadow-md {headerWidthStyle}"
>
	<div class="flex flex-wrap items-center justify-between p-4">
		<button
			type="button"
			class="text-onsurface dark:text-onsurface-dark hover:bg-outline dark:hover:bg-outline-dark inline-flex h-8 w-8 items-center justify-center rounded-lg p-1"
			onclick={() => {
				if (isNav) {
					open = !open;
				} else if (dialog) {
					dialog.showModal();
					open = true;
				}
			}}
		>
			<Menu class="size-6" />
		</button>
	</div>
</header>
<main class="h-screen overflow-x-hidden pt-16 {mainPaddingStyle}">
	{@render children()}
</main>
