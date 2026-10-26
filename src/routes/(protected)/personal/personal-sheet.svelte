<script lang="ts" module>
	export interface EditablePersonalExpense {
		id: string;
		description: string;
		category: string;
		amountMinor: number;
		currency: string;
		spentOn: string;
		aside: boolean;
		fromBank: boolean;
		folderId: string | null;
	}
</script>

<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import { untrack } from "svelte";

	import {
		categoryOptions,
		categoryStyle,
		type CustomCategory,
	} from "#lib/categories.js";
	import DateField from "#lib/components/date-field.svelte";
	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { Switch } from "#lib/components/ui/switch/index.js";
	import { currencies } from "#lib/currencies.js";
	import { haptic } from "#lib/haptics.js";
	import { minorToDecimal } from "#lib/money.js";
	import { guessCategory, isMoneyAside } from "#lib/smart-category.js";
	import { enhanceToast } from "#lib/toast.js";

	interface Props {
		open: boolean;
		action: string;
		defaultCurrency: string;
		folders: { id: string; name: string }[];
		categories: CustomCategory[];
		defaultFolderId: string | null;
		expense?: EditablePersonalExpense;
		onSaved?: (result: Record<string, unknown> | undefined) => void;
	}

	let {
		open = $bindable(),
		action,
		defaultCurrency,
		folders,
		categories,
		defaultFolderId,
		expense,
		onSaved,
	}: Props = $props();

	function initialState() {
		return {
			amount: expense
				? minorToDecimal(expense.amountMinor, expense.currency)
				: "",
			currency: expense?.currency ?? defaultCurrency,
			description: expense?.description ?? "",
			category: expense?.category ?? "other",
			categoryPicked: expense !== undefined,
			aside: expense?.aside ?? false,
			asidePicked: expense !== undefined,
			spentOn: expense?.spentOn ?? new Date().toISOString().slice(0, 10),
			folderId: expense ? (expense.folderId ?? "") : (defaultFolderId ?? ""),
		};
	}

	let form = $state(untrack(initialState));
	const locked = $derived(expense?.fromBank ?? false);
	let errors = $state<Record<string, string[]>>({});

	$effect(() => {
		if (open) {
			untrack(() => {
				form = initialState();
				errors = {};
			});
		}
	});

	function suggest() {
		if (!form.asidePicked) {
			form.aside = isMoneyAside(form.description);
		}
		const guessed =
			guessCategory(form.description, categories) ??
			(form.aside ? "finance" : undefined);
		if (!form.categoryPicked && guessed) {
			form.category = guessed;
		}
	}
</script>

<ResponsiveSheet
	bind:open
	wide
	title={expense ? "Edit expense" : "New expense"}
>
	<form
		method="POST"
		action="{action}?/{expense ? 'update' : 'create'}"
		class="flex flex-col gap-5 pb-4 md:max-h-[70vh] md:overflow-y-auto"
		use:enhance={enhanceToast({
			loading: expense ? "Saving expense" : "Adding expense",
			success: expense ? "Expense saved." : "Expense added.",
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: (result) => {
				haptic("success");
				open = false;
				onSaved?.(result);
			},
		})}
	>
		{#if expense}
			<input type="hidden" name="id" value={expense.id} />
		{/if}
		<label class="flex flex-col items-center gap-1 pt-1">
			<span class="sr-only">Amount</span>
			<div
				class="font-display flex items-baseline gap-2 text-5xl font-semibold tabular"
			>
				<input
					name="amount"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0"
					required
					readonly={locked}
					bind:value={form.amount}
					class="w-full max-w-56 bg-transparent text-center outline-none placeholder:text-muted-foreground/40"
				/>
				{#if locked}
					<input type="hidden" name="currency" value={form.currency} />
				{/if}
				<select
					name={locked ? undefined : "currency"}
					aria-label="Currency"
					disabled={locked}
					bind:value={form.currency}
					class="text-muted-foreground min-h-11 appearance-none bg-transparent text-2xl outline-none"
				>
					{#each currencies as code (code)}
						<option value={code}>{code}</option>
					{/each}
				</select>
			</div>
			{#if errors.amount}
				<span class="text-destructive text-sm">{errors.amount[0]}</span>
			{/if}
			{#if locked}
				<span class="text-muted-foreground text-sm"
					>From your bank: the amount and what it was stay as the bank says.</span
				>
			{/if}
		</label>
		<Field.Field>
			<Field.Label for="personal-description">What for</Field.Label>
			<Input
				id="personal-description"
				name="description"
				placeholder="Groceries"
				required
				maxlength={120}
				readonly={locked}
				bind:value={form.description}
				oninput={suggest}
				class="read-only:text-muted-foreground read-only:bg-muted/50 h-11"
			/>
			<Field.Error
				errors={errors.description?.map((message) => ({ message }))}
			/>
		</Field.Field>
		<div class="grid grid-cols-2 gap-3">
			<Field.Field>
				<Field.Label for="personal-category">Category</Field.Label>
				<Picker
					id="personal-category"
					name="category"
					label="Category"
					options={categoryOptions(categories).map((option) => ({
						...option,
						tint: categoryStyle(option),
					}))}
					bind:value={form.category}
					onPick={() => (form.categoryPicked = true)}
				/>
			</Field.Field>
			<Field.Field>
				<Field.Label for="personal-date">Date</Field.Label>
				<DateField
					id="personal-date"
					name="spentOn"
					label="Date"
					bind:value={form.spentOn}
				/>
			</Field.Field>
		</div>
		<div class="flex items-start justify-between gap-4">
			<label for="personal-aside" class="min-w-0 cursor-pointer">
				<span class="block font-medium">Set aside, not spent</span>
				<span class="text-muted-foreground mt-0.5 block text-sm"
					>Savings or investing: counted apart from what you spend.</span
				>
			</label>
			<Switch
				id="personal-aside"
				name="aside"
				value="true"
				bind:checked={form.aside}
				onCheckedChange={() => (form.asidePicked = true)}
				class="mt-1 shrink-0"
			/>
		</div>
		{#if folders.length > 0}
			<Field.Field>
				<Field.Label for="personal-folder">Folder</Field.Label>
				<Picker
					id="personal-folder"
					name="folderId"
					label="Folder"
					options={[
						{ value: "", label: "No folder" },
						...folders.map((folder) => ({
							value: folder.id,
							label: folder.name,
						})),
					]}
					bind:value={form.folderId}
				/>
			</Field.Field>
		{/if}
		<div class="bg-popover sticky bottom-0 z-10 -mb-4 pt-2 pb-4">
			<Button
				type="submit"
				size="lg"
				class="glow h-12 w-full rounded-xl text-base"
			>
				{#if expense}<CheckIcon />{:else}<PlusIcon />{/if}
				{expense ? "Save expense" : "Add expense"}
			</Button>
		</div>
	</form>
</ResponsiveSheet>
