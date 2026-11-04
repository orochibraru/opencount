<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import RepeatIcon from "@lucide/svelte/icons/repeat";

	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import {
		recurringTypeLabels,
		recurringTypes,
		type SeriesSettings,
	} from "#lib/recurring-schedule.js";
	import { enhanceToast } from "#lib/toast.js";

	interface Props {
		open: boolean;
		target:
			| { expenseId: string; description: string; seriesId: string | null }
			| { seriesId: string };
		series: SeriesSettings[];
		action: string;
	}

	let { open = $bindable(), target, series, action }: Props = $props();

	const typeOptions = recurringTypes.map((type) => ({
		value: type,
		label: recurringTypeLabels[type],
	}));
	const frequencyOptions = [
		{ value: "", label: "Read it from the payments" },
		{ value: "weekly", label: "Every week" },
		{ value: "monthly", label: "Every month" },
		{ value: "quarterly", label: "Every 3 months" },
		{ value: "yearly", label: "Every year" },
	];

	let label = $state("");
	let type = $state("other");
	let frequency = $state("");
	let remaining = $state("");
	let errors = $state<Record<string, string[]>>({});

	const current = $derived(
		series.find((entry) => entry.id === target.seriesId),
	);
	const editing = $derived(!("expenseId" in target));

	$effect(() => {
		if (open) {
			label = current?.label ?? "";
			type = current?.type ?? "other";
			frequency = current?.frequency ?? "";
			remaining = "";
			errors = {};
		}
	});

	function pick(existing: SeriesSettings) {
		label = existing.label;
		type = existing.type;
		frequency = existing.frequency ?? "";
	}
</script>

<ResponsiveSheet
	bind:open
	title={editing ? "Recurring payment" : "Mark as recurring"}
	description={"expenseId" in target
		? `${target.description} and every line like it, synced later too, join the series.`
		: "Change how this series is named and when it comes back."}
>
	<form
		method="POST"
		action="{action}?/recurring"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Saving the series",
			success: "Saved as recurring.",
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				open = false;
			},
		})}
	>
		<input
			type="hidden"
			name="expenseId"
			value={"expenseId" in target ? target.expenseId : ""}
		/>
		<input
			type="hidden"
			name="seriesId"
			value={editing ? target.seriesId : ""}
		/>
		<Field.Field>
			<Field.Label for="recurring-label">Label</Field.Label>
			<Input
				id="recurring-label"
				name="label"
				required
				maxlength={40}
				placeholder="Car loan"
				class="h-11"
				bind:value={label}
			/>
			<Field.Error errors={errors.label?.map((message) => ({ message }))} />
		</Field.Field>
		{#if !editing && series.length > 0}
			<ul class="flex flex-wrap gap-2" aria-label="Your series">
				{#each series as existing (existing.id)}
					<li>
						<Button
							type="button"
							variant={existing.label === label ? "default" : "secondary"}
							class="h-11 rounded-full px-4"
							onclick={() => pick(existing)}
						>
							<RepeatIcon />
							{existing.label}
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
		<Field.Field>
			<Field.Label for="recurring-type">Type</Field.Label>
			<Picker
				id="recurring-type"
				name="type"
				label="Type"
				options={typeOptions}
				bind:value={type}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="recurring-frequency">Comes back</Field.Label>
			<Picker
				id="recurring-frequency"
				name="frequency"
				label="Comes back"
				options={frequencyOptions}
				bind:value={frequency}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="recurring-remaining">Payments left</Field.Label>
			<Input
				id="recurring-remaining"
				name="remaining"
				inputmode="numeric"
				placeholder={current?.endDate
					? `Ends ${current.endDate}`
					: "Leave empty when it has no end"}
				class="h-11"
				bind:value={remaining}
			/>
			<Field.Description
				>From the next one: a loan with 12 payments to go takes 12.</Field.Description
			>
			<Field.Error errors={errors.remaining?.map((message) => ({ message }))} />
		</Field.Field>
		<Button type="submit" class="h-11 rounded-xl">
			<CheckIcon />
			Save
		</Button>
	</form>
</ResponsiveSheet>
