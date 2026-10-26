<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import { toast } from "svelte-sonner";
	import { MediaQuery } from "svelte/reactivity";

	import { haptic } from "#lib/haptics.js";

	const threshold = 72;
	const installed = new MediaQuery("(display-mode: standalone)");

	let startY: number | undefined;
	let distance = $state(0);
	let refreshing = $state(false);

	function touchStart(event: TouchEvent) {
		const inDialog =
			event.target instanceof Element &&
			event.target.closest("[role='dialog']") !== null;
		if (installed.current && !refreshing && !inDialog && window.scrollY <= 0) {
			startY = event.touches[0]?.clientY;
		}
	}

	function touchMove(event: TouchEvent) {
		const y = event.touches[0]?.clientY;
		if (startY === undefined || y === undefined) {
			return;
		}
		const pulled = Math.min((y - startY) * 0.5, threshold * 1.4);
		if (pulled >= threshold && distance < threshold) {
			haptic("tap");
		}
		distance = Math.max(0, pulled);
	}

	function touchEnd() {
		if (startY === undefined) {
			return;
		}
		startY = undefined;
		if (distance >= threshold) {
			handleRefresh();
		} else {
			distance = 0;
		}
	}

	async function refreshCallback() {
		refreshing = true;
		try {
			await invalidateAll();
		} finally {
			refreshing = false;
			distance = 0;
		}
	}

	function handleRefresh() {
		toast.promise(refreshCallback(), {
			loading: "Refreshing",
			success: "Up to date.",
			error: "Couldn't refresh. Check your connection.",
		});
	}
</script>

<svelte:window
	ontouchstart={touchStart}
	ontouchmove={touchMove}
	ontouchend={touchEnd}
	ontouchcancel={touchEnd}
/>

{#if distance > 0 || refreshing}
	<div
		class="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 flex justify-center"
		style="transform: translateY({refreshing ? threshold / 2 : distance / 2}px)"
		aria-hidden="true"
	>
		<span
			class="glass flex size-10 items-center justify-center rounded-full shadow-md"
		>
			<RefreshCwIcon
				class="text-primary size-5 {refreshing ? 'animate-spin' : ''}"
				style="transform: rotate({refreshing
					? 0
					: distance * 4}deg); opacity: {Math.min(
					1,
					distance / threshold + (refreshing ? 1 : 0),
				)}"
			/>
		</span>
	</div>
{/if}
