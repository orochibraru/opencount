<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { resolve } from "$app/paths";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import FileIcon from "@lucide/svelte/icons/file";

	import IconButton from "#lib/components/icon-button.svelte";
	import { Spinner } from "#lib/components/ui/spinner/index.js";

	interface Download {
		id: string;
		fileName: string;
		status: "pending" | "ready" | "failed";
		error: string | null;
		createdAt: Date;
	}

	const { downloads }: { downloads: Download[] } = $props();

	const building = $derived(
		downloads.some((download) => download.status === "pending"),
	);

	$effect(() => {
		if (!building) {
			return;
		}
		const timer = setInterval(() => void invalidateAll(), 2000);
		return () => clearInterval(timer);
	});
</script>

{#if downloads.length > 0}
	<ul
		class="glass divide-border divide-y overflow-hidden rounded-2xl"
		aria-label="Your files"
	>
		{#each downloads as download (download.id)}
			<li class="flex min-h-16 items-center gap-3 px-3 py-2 md:px-4">
				<span
					class="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl"
				>
					{#if download.status === "pending"}<Spinner
							class="size-5"
						/>{:else}<FileIcon class="size-5" />{/if}
				</span>
				<span class="min-w-0 flex-1">
					<span class="block truncate font-medium">{download.fileName}</span>
					<span
						class="block truncate text-sm {download.status === 'failed'
							? 'text-destructive'
							: 'text-muted-foreground'}"
					>
						{download.status === "pending"
							? "Preparing…"
							: download.status === "failed"
								? (download.error ?? "Couldn't build it.")
								: `Ready, kept for a day · ${download.createdAt.toLocaleString()}`}
					</span>
				</span>
				{#if download.status === "ready"}
					<IconButton
						label="Download {download.fileName}"
						icon={DownloadIcon}
						href={resolve("/(protected)/downloads/[id]", { id: download.id })}
						download={download.fileName}
						data-sveltekit-reload
					/>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
