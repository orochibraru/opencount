<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import CheckIcon from "@lucide/svelte/icons/check";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import XIcon from "@lucide/svelte/icons/x";

	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

	import PersonalView from "../../personal-view.svelte";

	const { data } = $props();

	const action = resolve("/(protected)/personal");

	let adding = $state(false);
	let renameOpen = $state(false);
	let deleteOpen = $state(false);

	setPageTitle(
		() => data.folder.name,
		() => action,
		() => [
			{
				label: "Rename folder",
				icon: PencilIcon,
				onSelect: () => (renameOpen = true),
			},
			{
				label: "Delete folder",
				icon: Trash2Icon,
				onSelect: () => (deleteOpen = true),
			},
			{
				label: "Add expense",
				icon: PlusIcon,
				onSelect: () => (adding = true),
				primary: true,
			},
		],
	);

	const months = $derived(
		data.stats.byMonth
			.filter((row) => row.currency === data.defaultCurrency)
			.slice(0, 6),
	);
	const largestMonth = $derived(Math.max(1, ...months.map((row) => row.minor)));
</script>

<PersonalView
	expenses={data.expenses}
	hasMore={data.hasMore}
	matching={data.matching}
	pageSize={data.pageSize}
	stats={data.stats}
	folders={data.folders}
	shareGroups={data.shareGroups}
	defaultCurrency={data.defaultCurrency}
	folder={data.folder}
	empty="Add expenses here, or move one in from its edit sheet."
	bind:adding
>
	{#snippet aside()}
		{#if months.length > 0}
			<section class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6">
				<h2 class="font-semibold">By month</h2>
				<ul class="flex flex-col gap-2.5 text-sm">
					{#each months as row (row.month)}
						<li class="flex flex-col gap-1">
							<span class="flex justify-between">
								<span
									>{new Date(`${row.month}-01T12:00:00`).toLocaleDateString(
										undefined,
										{ month: "long", year: "numeric" },
									)}</span
								>
								<span class="tabular"
									>{formatMoney(row.minor, row.currency)}</span
								>
							</span>
							<span
								class="bg-muted h-1.5 overflow-hidden rounded-full"
								aria-hidden="true"
							>
								<span
									class="bg-primary block h-full rounded-full"
									style="width: {Math.max(
										2,
										(row.minor / largestMonth) * 100,
									)}%"
								></span>
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/snippet}
</PersonalView>

<ResponsiveSheet bind:open={renameOpen} title="Rename {data.folder.name}">
	<form
		method="POST"
		action="{action}?/saveFolder"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Renaming",
			success: "Renamed.",
			onSuccess: () => {
				renameOpen = false;
			},
		})}
	>
		<input type="hidden" name="id" value={data.folder.id} />
		<Field.Field>
			<Field.Label for="folder-rename">Name</Field.Label>
			<Input
				id="folder-rename"
				name="name"
				value={data.folder.name}
				required
				maxlength={60}
				class="h-11"
			/>
		</Field.Field>
		<Button type="submit" class="h-11 rounded-xl">
			<CheckIcon />
			Save name
		</Button>
	</form>
</ResponsiveSheet>

<ResponsiveSheet
	bind:open={deleteOpen}
	title="Delete {data.folder.name}?"
	description="Its expenses stay in your personal expenses, out of any folder."
>
	<form
		method="POST"
		action="{action}?/deleteFolder"
		class="flex flex-col-reverse gap-2 pb-4 md:flex-row md:justify-end"
		use:enhance={enhanceToast({
			loading: "Deleting the folder",
			success: "Folder deleted.",
		})}
	>
		<input type="hidden" name="id" value={data.folder.id} />
		<Button
			variant="outline"
			class="h-11 rounded-xl"
			onclick={() => (deleteOpen = false)}><XIcon />Cancel</Button
		>
		<Button type="submit" variant="destructive" class="h-11 rounded-xl">
			<Trash2Icon />
			Delete folder
		</Button>
	</form>
</ResponsiveSheet>
