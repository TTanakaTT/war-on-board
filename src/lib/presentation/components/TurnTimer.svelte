<script lang="ts">
	import { timerState } from '$lib/presentation/state/TimerState.svelte';
	import Timer from 'svelte-material-icons/Timer.svelte';

	// Track the timer state reactively
	let timeRemaining = $derived(timerState.getTimeRemaining());
	let isActive = $derived(timerState.isActive());

	let timerColor = $derived.by(() => {
		if (!isActive) return 'text-gray-500';
		if (timeRemaining <= 3) return 'text-red-600';
		return 'text-onbackground dark:text-onbackground-dark';
	});
</script>

<div class="timer-container flex items-center gap-1 font-bold {timerColor}">
	<Timer class="size-6" />
	<div class="timer-value text-xl">
		{timeRemaining}
	</div>
	<button
		type="button"
		onclick={() => timerState.stopTimer()}
		class="text-sm text-gray-500 hover:underline"
	>
		stop
	</button>
	<button
		type="button"
		onclick={() => timerState.startTimer()}
		class="text-sm text-gray-500 hover:underline"
	>
		start
	</button>
	<button
		type="button"
		onclick={() => timerState.resetTimer()}
		class="text-sm text-gray-500 hover:underline"
	>
		reset
	</button>
</div>
