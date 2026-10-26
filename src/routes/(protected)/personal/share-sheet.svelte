<script lang="ts">
	import { enhance } from "$app/forms";
	import UsersIcon from "@lucide/svelte/icons/users";

	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { haptic } from "#lib/haptics.js";
	import { formatMoney } from "#lib/money.js";
	import { enhanceToast } from "#lib/toast.js";

	interface Props {
		open: boolean;
		expense: {
			id: string;
			description: string;
			amountMinor: number;
			currency: string;
		};
		groups: { id: string; name: string; currency: string }[];
		action: string;
	}

	let { open = $bindable(), expense, groups, action }: Props = $props();

	let groupId = $state("");
</script>

<ResponsiveSheet
	bind:open
	title="Split in a group"
	description="{expense.description}, {formatMoney(
		expense.amountMinor,
		expense.currency,
	)}: added as paid by you, split equally between everyone. Edit it there to change the split."
>
	<form
		method="POST"
		action="{action}?/share"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Adding it to the group",
			success: (result) => `Added to ${String(result?.sharedIn)}.`,
			onSuccess: () => {
				haptic("success");
				open = false;
			},
		})}
	>
		<input type="hidden" name="id" value={expense.id} />
		<Field.Field>
			<Field.Label for="share-group">Group</Field.Label>
			<Picker
				id="share-group"
				name="groupId"
				label="Group"
				options={groups.map((group) => ({
					value: group.id,
					label: `${group.name} (${group.currency})`,
				}))}
				bind:value={groupId}
				placeholder="Pick a group"
			/>
		</Field.Field>
		<Button type="submit" class="h-11 rounded-xl" disabled={!groupId}>
			<UsersIcon />
			Add to the group
		</Button>
	</form>
</ResponsiveSheet>
