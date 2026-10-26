<script lang="ts">
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	import { offlineQueue } from "#lib/offline-queue.svelte.js";

	async function syncCallback(): Promise<string> {
		const { synced, rejected } = await offlineQueue.sync();
		if (rejected.length > 0) {
			throw new Error(
				`Couldn't add ${rejected.join(", ")}: the group changed meanwhile. Add ${rejected.length === 1 ? "it" : "them"} again.`,
			);
		}
		return synced === 1
			? "Your offline expense is added."
			: `Your ${synced} offline expenses are added.`;
	}

	async function handleSync() {
		try {
			await offlineQueue.load();
		} catch {
			return;
		}
		if (offlineQueue.pending.length === 0 || !navigator.onLine) {
			return;
		}
		toast.promise(syncCallback(), {
			loading: "Adding what you saved offline",
			success: (message: string) => message,
			error: (error: unknown) =>
				error instanceof Error
					? error.message
					: "Couldn't sync. It tries again later.",
		});
	}

	onMount(() => {
		void handleSync();
	});
</script>

<svelte:window ononline={() => void handleSync()} />
