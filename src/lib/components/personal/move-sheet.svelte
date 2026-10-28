<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import FolderOutputIcon from "@lucide/svelte/icons/folder-output";

	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { enhanceToast } from "#lib/toast.js";

	interface Props {
		open: boolean;
		expense: { id: string; description: string; folderId: string | null };
		folders: { id: string; name: string }[];
		action: string;
	}

	let { open = $bindable(), expense, folders, action }: Props = $props();

	const choices = $derived([
		...folders.map((folder) => ({
			value: folder.id,
			label: folder.name,
			icon: FolderIcon,
		})),
		{ value: "", label: "No folder", icon: FolderOutputIcon },
	]);
</script>

<ResponsiveSheet
	bind:open
	title="Move to folder"
	description={expense.description}
>
	<form
		method="POST"
		action="{action}?/moveToFolder"
		class="pb-4"
		use:enhance={enhanceToast({
			loading: "Moving it",
			success: "Moved.",
			onSuccess: () => {
				open = false;
			},
		})}
	>
		<input type="hidden" name="id" value={expense.id} />
		<ul class="flex flex-col gap-1">
			{#each choices as choice (choice.value)}
				{@const current = (expense.folderId ?? "") === choice.value}
				<li>
					<button
						type="submit"
						name="folderId"
						value={choice.value}
						disabled={current}
						class="hover:bg-muted flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left disabled:opacity-100 {current
							? 'bg-muted font-medium'
							: ''}"
					>
						<span
							class="category-tile flex size-9 items-center justify-center rounded-lg"
							style="--category-chroma: 0"
						>
							<choice.icon class="size-4" />
						</span>
						<span class="min-w-0 flex-1 truncate">{choice.label}</span>
						{#if current}<CheckIcon class="text-muted-foreground size-4" />{/if}
					</button>
				</li>
			{/each}
		</ul>
	</form>
</ResponsiveSheet>
