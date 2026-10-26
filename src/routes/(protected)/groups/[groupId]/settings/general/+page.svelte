<script lang="ts">
	import { enhance } from "$app/forms";
	import ArchiveIcon from "@lucide/svelte/icons/archive";
	import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";
	import CheckIcon from "@lucide/svelte/icons/check";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import XIcon from "@lucide/svelte/icons/x";

	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { currencies } from "#lib/currencies.js";
	import { enhanceToast, saveToast } from "#lib/toast.js";

	const { data } = $props();

	let errors = $state<Record<string, string[]>>({});
	let confirmDelete = $state(false);
</script>

<div class="grid gap-6 lg:grid-cols-2 lg:items-start">
	<form
		method="POST"
		action="?/save"
		class="glass flex flex-col gap-5 rounded-2xl p-4 md:p-6"
		use:enhance={enhanceToast({
			loading: "Saving group",
			success: "Group saved.",
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				errors = {};
			},
		})}
	>
		<h2 class="text-lg font-semibold">Group</h2>
		<Field.Field>
			<Field.Label for="group-settings-name">Name</Field.Label>
			<Input
				id="group-settings-name"
				name="name"
				value={data.group.name}
				required
				maxlength={60}
				class="h-11"
			/>
			<Field.Error errors={errors.name?.map((message) => ({ message }))} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="group-settings-currency">Currency</Field.Label>
			<Picker
				id="group-settings-currency"
				name="currency"
				label="Currency"
				options={currencies.map((currency) => ({
					value: currency,
					label: currency,
				}))}
				value={data.group.currency}
				disabled={data.currencyLocked}
			/>
			{#if data.currencyLocked}
				<Field.Description
					>Locked: expenses are already recorded in {data.group
						.currency}.</Field.Description
				>
			{/if}
			<Field.Error errors={errors.currency?.map((message) => ({ message }))} />
		</Field.Field>
		<Button type="submit" class="h-11 self-start rounded-xl px-5">
			<CheckIcon />
			Save
		</Button>
	</form>

	<form
		method="POST"
		action="?/setArchived"
		class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6"
		use:enhance={enhanceToast({
			loading: data.group.archived ? "Bringing it back" : "Archiving",
			success: data.group.archived
				? "Back in your groups."
				: "Archived. Find it under archived groups.",
		})}
	>
		<input type="hidden" name="archived" value={String(!data.group.archived)} />
		<h2 class="text-lg font-semibold">
			{data.group.archived ? "Archived" : "Archive"}
		</h2>
		<p class="text-muted-foreground text-sm">
			{data.group.archived
				? "Hidden from your groups. Bring it back whenever you need it."
				: "Done with it? Hide it from your groups. Only for you: the others keep it, and nothing is deleted."}
		</p>
		<Button
			type="submit"
			variant="outline"
			class="h-11 self-start rounded-xl px-5"
		>
			{#if data.group.archived}<ArchiveRestoreIcon />{:else}<ArchiveIcon />{/if}
			{data.group.archived ? "Unarchive" : "Archive group"}
		</Button>
	</form>
	{#if data.isOwner}
		<section class="glass flex flex-col gap-3 rounded-2xl p-4 md:p-6">
			<h2 class="text-lg font-semibold">Delete group</h2>
			<p class="text-muted-foreground text-sm">
				Deletes every expense and balance in it, for everyone. This can't be
				undone.
			</p>
			<Button
				variant="destructive"
				class="h-11 self-start rounded-xl px-5"
				onclick={() => (confirmDelete = true)}
			>
				<Trash2Icon />
				Delete group
			</Button>
		</section>
	{/if}
</div>

<ResponsiveSheet
	bind:open={confirmDelete}
	title="Delete {data.group.name}?"
	description="Every expense and balance in it goes, for everyone."
>
	<form
		method="POST"
		action="?/delete"
		class="flex flex-col-reverse gap-2 pb-4 md:flex-row md:justify-end"
		use:enhance={saveToast("Group")}
	>
		<Button
			variant="outline"
			class="h-11 rounded-xl"
			onclick={() => (confirmDelete = false)}><XIcon />Cancel</Button
		>
		<Button type="submit" variant="destructive" class="h-11 rounded-xl">
			<Trash2Icon />
			Delete group
		</Button>
	</form>
</ResponsiveSheet>
