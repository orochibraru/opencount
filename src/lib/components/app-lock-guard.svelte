<script lang="ts">
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { onMount } from "svelte";

	import { keepUnlocked, lockApp } from "#lib/remote/app-lock.remote.js";

	const { lockAfterMinutes }: { lockAfterMinutes: number | null } = $props();

	const storageKey = "opencount-last-active";
	const pingEveryMs = 60_000;

	let covered = $state(false);
	let lastPing = 0;
	let lastStored = 0;

	function readLastActive(): number {
		try {
			return Number(localStorage.getItem(storageKey)) || 0;
		} catch {
			return 0;
		}
	}

	function storeLastActive(now: number): boolean {
		try {
			localStorage.setItem(storageKey, String(now));
			return true;
		} catch {
			return false;
		}
	}

	function markActive() {
		const now = Date.now();
		if (now - lastStored > 5000 && storeLastActive(now)) {
			lastStored = now;
		}
		if (lockAfterMinutes !== null && now - lastPing > pingEveryMs) {
			lastPing = now;
			keepUnlocked().catch(() => undefined);
		}
	}

	async function lockNow() {
		covered = true;
		await lockApp().catch(() => undefined);
		const target = encodeURIComponent(`${page.url.pathname}${page.url.search}`);
		location.replace(`${resolve("/auth/unlock")}?redirectTo=${target}`);
	}

	function checkIdle() {
		if (lockAfterMinutes === null || covered) {
			return;
		}
		const last = readLastActive();
		if (last > 0 && Date.now() - last > lockAfterMinutes * 60_000) {
			void lockNow();
		}
	}

	function handleVisibility() {
		if (document.visibilityState === "visible") {
			checkIdle();
		}
	}

	onMount(() => {
		checkIdle();
		markActive();
		const timer = setInterval(checkIdle, 15_000);
		return () => clearInterval(timer);
	});
</script>

<svelte:document
	onvisibilitychange={handleVisibility}
	onpointerdown={markActive}
	onkeydown={markActive}
/>

{#if covered}
	<div class="bg-background fixed inset-0 z-100" aria-hidden="true"></div>
{/if}
