<script lang="ts">
	import { enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import PlusIcon from "@lucide/svelte/icons/plus";

	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { currencies } from "#lib/currencies.js";
	import { haptic } from "#lib/haptics.js";
	import { enhanceToast } from "#lib/toast.js";

	let { open = $bindable() }: { open: boolean } = $props();

	let pending = $state(false);
	let errors = $state<Record<string, string[]>>({});
</script>

<ResponsiveSheet
	bind:open
	title="New group"
	description="You can add members once it's created."
>
	<form
		method="POST"
		action="?/create"
		class="flex flex-col gap-5 pb-4"
		use:enhance={enhanceToast({
			loading: "Creating group",
			success: "Group created.",
			reset: true,
			onStart: () => (pending = true),
			onSettled: () => (pending = false),
			onFailure: (data) =>
				(errors = (data?.errors as Record<string, string[]>) ?? {}),
			onSuccess: async (result) => {
				haptic("success");
				errors = {};
				open = false;
				const group = result?.group as { id: string } | undefined;
				if (group) {
					await goto(
						resolve("/(protected)/groups/[groupId]/settings/members", {
							groupId: group.id,
						}),
					);
				}
			},
		})}
	>
		<Field.Field>
			<Field.Label for="group-name">Name</Field.Label>
			<Input
				id="group-name"
				name="name"
				placeholder="Lisbon trip"
				autocomplete="off"
				required
				maxlength={60}
				class="h-11"
			/>
			<Field.Error errors={errors.name?.map((message) => ({ message }))} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="group-currency">Currency</Field.Label>
			<Picker
				id="group-currency"
				name="currency"
				label="Currency"
				options={currencies.map((currency) => ({
					value: currency,
					label: currency,
				}))}
				value={currencies[0]}
			/>
			<Field.Error errors={errors.currency?.map((message) => ({ message }))} />
		</Field.Field>
		<Button
			type="submit"
			size="lg"
			class="h-12 rounded-xl text-base"
			disabled={pending}>Create group</Button
		>
	</form>
</ResponsiveSheet>
