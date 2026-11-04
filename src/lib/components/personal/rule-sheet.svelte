<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";

	import { categoryOptions, type CustomCategory } from "#lib/categories.js";
	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Switch } from "#lib/components/ui/switch/index.js";
	import type { SeriesSettings } from "#lib/recurring-schedule.js";
	import { enhanceToast } from "#lib/toast.js";

	export interface RuleDraft {
		id: string;
		pattern: string;
		category: string | null;
		tag: string | null;
		pay: boolean;
		recurringId: string | null;
	}

	interface Props {
		open: boolean;
		draft: RuleDraft;
		categories: CustomCategory[];
		series: SeriesSettings[];
		action: string;
	}

	let {
		open = $bindable(),
		draft,
		categories,
		series,
		action,
	}: Props = $props();

	const categoryChoices = $derived([
		{ value: "", label: "Leave it as it is" },
		...categoryOptions(categories).map(({ value, label }) => ({
			value,
			label,
		})),
	]);
	const seriesChoices = $derived([
		{ value: "", label: "None" },
		...series.map((entry) => ({ value: entry.id, label: entry.label })),
	]);

	let pattern = $state("");
	let category = $state("");
	let tag = $state("");
	let pay = $state(false);
	let recurringId = $state("");
	let errors = $state<Record<string, string[]>>({});

	$effect(() => {
		if (open) {
			pattern = draft.pattern;
			category = draft.category ?? "";
			tag = draft.tag ?? "";
			pay = draft.pay;
			recurringId = draft.recurringId ?? "";
			errors = {};
		}
	});
</script>

<ResponsiveSheet
	bind:open
	title={draft.id ? "Edit the rule" : "New rule"}
	description="Every line whose description has this in it, past and future, gets what you pick."
>
	<form
		method="POST"
		action="{action}?/save"
		class="flex flex-col gap-4 pb-4"
		use:enhance={enhanceToast({
			loading: "Saving the rule",
			success: (data) =>
				`Rule saved, ${Number(data?.applied ?? 0)} ${Number(data?.applied) === 1 ? "line" : "lines"} updated.`,
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				open = false;
			},
		})}
	>
		<input type="hidden" name="id" value={draft.id} />
		<Field.Field>
			<Field.Label for="rule-pattern">Description has</Field.Label>
			<Input
				id="rule-pattern"
				name="pattern"
				required
				maxlength={60}
				placeholder="Station"
				class="h-11"
				bind:value={pattern}
			/>
			<Field.Description
				>Case, accents and plurals don't matter.</Field.Description
			>
			<Field.Error errors={errors.pattern?.map((message) => ({ message }))} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="rule-category">Category</Field.Label>
			<Picker
				id="rule-category"
				name="category"
				label="Category"
				options={categoryChoices}
				bind:value={category}
			/>
			<Field.Error errors={errors.category?.map((message) => ({ message }))} />
		</Field.Field>
		<Field.Field>
			<Field.Label for="rule-tag">Tag</Field.Label>
			<Input
				id="rule-tag"
				name="tag"
				maxlength={24}
				placeholder="Optional, like reimbursable"
				class="h-11"
				bind:value={tag}
			/>
			<Field.Error errors={errors.tag?.map((message) => ({ message }))} />
		</Field.Field>
		{#if series.length > 0}
			<Field.Field>
				<Field.Label for="rule-series">Recurring series</Field.Label>
				<Picker
					id="rule-series"
					name="recurringId"
					label="Recurring series"
					options={seriesChoices}
					bind:value={recurringId}
				/>
				<Field.Error
					errors={errors.recurringId?.map((message) => ({ message }))}
				/>
			</Field.Field>
		{/if}
		<Field.Field orientation="horizontal">
			<Field.Content>
				<Field.Label for="rule-pay">It's my pay</Field.Label>
				<Field.Description
					>Money in that matches counts as your salary.</Field.Description
				>
			</Field.Content>
			<Switch id="rule-pay" bind:checked={pay} />
			<input type="hidden" name="pay" value={String(pay)} />
		</Field.Field>
		<Button type="submit" class="h-11 rounded-xl">
			<CheckIcon />
			Save the rule
		</Button>
	</form>
</ResponsiveSheet>
