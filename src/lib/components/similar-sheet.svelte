<script lang="ts" module>
	export interface SimilarExpense {
		id: string;
		description: string;
		spentOn: string;
		amountMinor: number;
		currency: string;
	}
</script>

<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import TagIcon from "@lucide/svelte/icons/tag";

	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { formatMoney } from "#lib/money.js";
	import { enhanceToast } from "#lib/toast.js";
	import { cn } from "#lib/utils.js";

	interface Props {
		open: boolean;
		category: { value: string; label: string };
		expenses: SimilarExpense[];
		action?: string;
	}

	let {
		open = $bindable(),
		category,
		expenses,
		action = "?/applyCategory",
	}: Props = $props();

	let picked = $state<string[]>([]);

	$effect(() => {
		if (open) {
			picked = expenses.map((entry) => entry.id);
		}
	});

	function toggle(id: string) {
		picked = picked.includes(id)
			? picked.filter((entry) => entry !== id)
			: [...picked, id];
	}
</script>

<ResponsiveSheet
	bind:open
	title="File these under {category.label} too?"
	description="They look like the one you just changed. Untick any that don't belong."
>
	<form
		method="POST"
		{action}
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Moving them",
			success: (result) =>
				`${Number(result?.moved)} moved to ${category.label}.`,
			onSuccess: () => {
				open = false;
			},
		})}
	>
		<input type="hidden" name="category" value={category.value} />
		<ul class="divide-border -mx-1 max-h-[50dvh] divide-y overflow-y-auto">
			{#each expenses as entry (entry.id)}
				{@const included = picked.includes(entry.id)}
				<li>
					{#if included}<input type="hidden" name="ids" value={entry.id} />{/if}
					<button
						type="button"
						role="checkbox"
						aria-checked={included}
						onclick={() => toggle(entry.id)}
						class="flex min-h-12 w-full items-center gap-3 px-1 text-left"
					>
						<span
							class={cn(
								"flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
								included
									? "bg-primary border-primary text-primary-foreground"
									: "border-input",
							)}
						>
							{#if included}<CheckIcon class="size-4" />{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{entry.description}</span
							>
							<span class="text-muted-foreground block text-sm"
								>{new Date(
									`${entry.spentOn}T12:00:00`,
								).toLocaleDateString()}</span
							>
						</span>
						<span class="text-sm tabular"
							>{formatMoney(entry.amountMinor, entry.currency)}</span
						>
					</button>
				</li>
			{/each}
		</ul>
		<Button
			type="submit"
			class="h-11 rounded-xl"
			disabled={picked.length === 0}
		>
			<TagIcon />
			Move {picked.length}
			{picked.length === 1 ? "expense" : "expenses"}
		</Button>
	</form>
</ResponsiveSheet>
