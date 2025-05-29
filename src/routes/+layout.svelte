<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Drawer from '$lib/components/Drawer.svelte';

	let { children } = $props();
	let open = $state(false);
	let dialog = $state<HTMLDialogElement | undefined>(undefined);

	let windowWidth = $state(0);
	let isNav = $derived(windowWidth > 1024);

	let mainPaddingStyle = $derived.by(() => {
		if (isNav) {
			return open ? 'pl-64' : 'pl-0';
		} else {
			return 'pl-0';
		}
	});

	function onClickDialog(event: MouseEvent): void {
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
	function onClickMenu(): void {
		if (isNav) {
			open = !open;
		} else if (dialog) {
			dialog.showModal();
			open = true;
		}
	}
</script>

<svelte:window bind:innerWidth={windowWidth} />

<Drawer {open} {isNav} {onClickDialog} bind:dialog />
<Header {open} {isNav} {onClickMenu} />
<main class="h-screen overflow-x-hidden pt-16 {mainPaddingStyle}">
	{@render children()}
</main>
