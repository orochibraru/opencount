<script lang="ts" module>
	export interface EditableExpense {
		id: string;
		description: string;
		category: string;
		amountMinor: number;
		paidBy: string;
		splitMode: "equal" | "exact" | "shares";
		spentOn: string;
		merchantId: string | null;
		shares: { memberId: string; amountMinor: number; weight: number }[];
	}
</script>

<script lang="ts">
	import { enhance } from "$app/forms";
	import CheckIcon from "@lucide/svelte/icons/check";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ScanTextIcon from "@lucide/svelte/icons/scan-text";
	import SparklesIcon from "@lucide/svelte/icons/sparkles";
	import { untrack } from "svelte";

	import { categoryOptions, type CustomCategory } from "#lib/categories.js";
	import DateField from "#lib/components/date-field.svelte";
	import Picker from "#lib/components/picker.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import * as Field from "#lib/components/ui/field/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { currencyDigits, formatMoney, parseMoney } from "#lib/money.js";
	import { type ReceiptReading, receiptTypes } from "#lib/receipts.js";
	import { frequencyLabels } from "#lib/recurrence.js";
	import { guessCategory } from "#lib/smart-category.js";
	import { splitByWeight } from "#lib/split.js";
	import { enhanceToast } from "#lib/toast.js";
	import { cn } from "#lib/utils.js";

	interface Props {
		open: boolean;
		currency: string;
		members: { id: string; displayName: string }[];
		merchants: { id: string; name: string; category: string }[];
		categories: CustomCategory[];
		defaultPayer: string | null;
		receiptsEnabled: boolean;
		expense?: EditableExpense;
	}

	let {
		open = $bindable(),
		currency,
		members,
		merchants,
		categories,
		defaultPayer,
		receiptsEnabled,
		expense,
	}: Props = $props();

	const today = () => new Date().toISOString().slice(0, 10);
	const asInput = (minor: number) =>
		(minor / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency));

	function initialState() {
		const shares = new Map(
			expense?.shares.map((share) => [share.memberId, share]) ?? [],
		);
		return {
			amount: expense ? asInput(expense.amountMinor) : "",
			description: expense?.description ?? "",
			merchant:
				merchants.find((merchant) => merchant.id === expense?.merchantId)
					?.name ?? "",
			category: expense?.category ?? "other",
			categoryPicked: expense !== undefined,
			categoryGuessed: false,
			repeat: "never",
			paidBy: expense?.paidBy ?? defaultPayer ?? members[0]?.id ?? "",
			spentOn: expense?.spentOn ?? today(),
			splitMode: expense?.splitMode ?? "equal",
			participants: expense
				? members
						.filter((member) => shares.has(member.id))
						.map((member) => member.id)
				: members.map((member) => member.id),
			weights: Object.fromEntries(
				members.map((member) => [
					member.id,
					String(shares.get(member.id)?.weight ?? 1),
				]),
			),
			exact: Object.fromEntries(
				members.map((member) => [
					member.id,
					shares.has(member.id)
						? asInput(shares.get(member.id)?.amountMinor ?? 0)
						: "",
				]),
			),
		};
	}

	let form = $state(untrack(initialState));
	let errors = $state<Record<string, string[]>>({});

	$effect(() => {
		if (open) {
			untrack(() => {
				form = initialState();
				errors = {};
			});
		}
	});

	const totalMinor = $derived(parseMoney(form.amount, currency) ?? 0);
	const preview = $derived.by(() => {
		if (form.splitMode === "exact") {
			return new Map(
				form.participants.map((memberId) => [
					memberId,
					parseMoney(form.exact[memberId] ?? "", currency) ?? 0,
				]),
			);
		}
		return splitByWeight(
			totalMinor,
			form.participants.map((memberId) => ({
				memberId,
				weight:
					form.splitMode === "shares"
						? Math.max(0, Math.floor(Number(form.weights[memberId] ?? 1)))
						: 1,
			})),
		);
	});
	const exactGap = $derived(
		form.splitMode === "exact"
			? totalMinor -
					[...preview.values()].reduce((sum, value) => sum + value, 0)
			: 0,
	);

	const merchantOptions = $derived(
		merchants.map((merchant) => ({
			value: merchant.name,
			label: merchant.name,
		})),
	);
	const categoryChoices = $derived(categoryOptions(categories));

	function suggest(category: string | undefined) {
		if (form.categoryPicked || !category) {
			return;
		}
		form.category = category;
		form.categoryGuessed = true;
	}

	function pickMerchant(name: string) {
		suggest(
			merchants.find((merchant) => merchant.name === name)?.category ??
				guessCategory(name, categories),
		);
	}

	let scanForm: HTMLFormElement | undefined = $state();
	let scanInput: HTMLInputElement | undefined = $state();

	function applyReading(reading: ReceiptReading | undefined) {
		if (!reading) {
			return;
		}
		if (reading.totalMinor !== null && reading.totalMinor > 0) {
			form.amount = asInput(reading.totalMinor);
		}
		if (reading.date) {
			form.spentOn = reading.date;
		}
		if (reading.merchant) {
			form.merchant = reading.merchant;
			if (!form.description) {
				form.description = reading.merchant;
			}
			pickMerchant(reading.merchant);
		}
	}

	const modes = [
		{ value: "equal", label: "Equally" },
		{ value: "shares", label: "By shares" },
		{ value: "exact", label: "Exact amounts" },
	] as const;

	function toggle(memberId: string) {
		form.participants = form.participants.includes(memberId)
			? form.participants.filter((id) => id !== memberId)
			: members
					.map((member) => member.id)
					.filter((id) => id === memberId || form.participants.includes(id));
	}
</script>

<ResponsiveSheet bind:open title={expense ? "Edit expense" : "New expense"}>
	{#if receiptsEnabled && !expense}
		<form
			method="POST"
			action="?/scan"
			enctype="multipart/form-data"
			class="pb-3"
			bind:this={scanForm}
			use:enhance={enhanceToast({
				loading: "Reading the receipt",
				success: "Receipt read. Check the amount before saving.",
				reset: true,
				onSuccess: (result) =>
					applyReading(result?.reading as ReceiptReading | undefined),
			})}
		>
			<input
				bind:this={scanInput}
				type="file"
				name="receipt"
				accept={receiptTypes.join(",")}
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
				onchange={() => scanForm?.requestSubmit()}
			/>
			<Button
				type="button"
				variant="secondary"
				class="h-11 w-full rounded-xl"
				onclick={() => scanInput?.click()}
			>
				<ScanTextIcon />
				Scan a receipt
			</Button>
		</form>
	{/if}
	<form
		method="POST"
		action={expense ? "?/update" : "?/create"}
		class="flex max-h-[75dvh] flex-col gap-5 overflow-y-auto pb-4 md:max-h-[70vh]"
		use:enhance={enhanceToast({
			loading: expense ? "Saving expense" : "Adding expense",
			success: expense ? "Expense saved." : "Expense added.",
			onFailure: (result) =>
				(errors = (result?.errors as Record<string, string[]>) ?? {}),
			onSuccess: () => {
				open = false;
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
					bind:value={form.amount}
					class="w-full max-w-56 bg-transparent text-center outline-none placeholder:text-muted-foreground/40"
				/>
				<span class="text-muted-foreground text-2xl">{currency}</span>
			</div>
			{#if errors.amount}
				<span class="text-destructive text-sm">{errors.amount[0]}</span>
			{/if}
		</label>

		<Field.Field>
			<Field.Label for="expense-description">What for</Field.Label>
			<Input
				id="expense-description"
				name="description"
				placeholder="Dinner at the harbour"
				required
				maxlength={120}
				bind:value={form.description}
				oninput={() => suggest(guessCategory(form.description, categories))}
				class="h-11"
			/>
			<Field.Error
				errors={errors.description?.map((message) => ({ message }))}
			/>
		</Field.Field>

		<div class="grid gap-3 sm:grid-cols-2">
			<Field.Field>
				<Field.Label for="expense-merchant">Where</Field.Label>
				<Picker
					id="expense-merchant"
					name="merchant"
					label="Where"
					options={merchantOptions}
					bind:value={form.merchant}
					placeholder="Optional"
					search={{
						placeholder: "Search or add a merchant",
						empty: "Type a name to add it.",
						creatable: true,
					}}
					clearLabel="No merchant"
					onPick={pickMerchant}
				/>
			</Field.Field>
			<Field.Field>
				<Field.Label for="expense-category">Category</Field.Label>
				<Picker
					id="expense-category"
					name="category"
					label="Category"
					options={categoryChoices}
					bind:value={form.category}
					placeholder="Pick a category"
					search={{
						placeholder: "Search categories",
						empty: "No category with that name.",
					}}
					onPick={() => {
						form.categoryPicked = true;
						form.categoryGuessed = false;
					}}
				/>
				{#if form.categoryGuessed}
					<Field.Description class="flex items-center gap-1.5">
						<SparklesIcon class="text-primary size-3.5" />
						Picked from the name
					</Field.Description>
				{/if}
			</Field.Field>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Field.Field>
				<Field.Label for="expense-paid-by">Paid by</Field.Label>
				<Picker
					id="expense-paid-by"
					name="paidBy"
					label="Paid by"
					options={members.map((member) => ({
						value: member.id,
						label: member.displayName,
					}))}
					bind:value={form.paidBy}
				/>
			</Field.Field>
			<Field.Field>
				<Field.Label for="expense-date">Date</Field.Label>
				<DateField
					id="expense-date"
					name="spentOn"
					label="Date"
					bind:value={form.spentOn}
				/>
			</Field.Field>
		</div>

		{#if !expense}
			<Field.Field>
				<Field.Label for="expense-repeat">Repeat</Field.Label>
				<Picker
					id="expense-repeat"
					name="repeat"
					label="Repeat"
					options={[
						{ value: "never", label: "Never" },
						...Object.entries(frequencyLabels).map(([value, label]) => ({
							value,
							label,
						})),
					]}
					bind:value={form.repeat}
				/>
				{#if form.repeat !== "never"}
					<Field.Description
						>A copy is added on each date from the next one, until you pause it.</Field.Description
					>
				{/if}
			</Field.Field>
		{/if}

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 text-sm font-medium">Split</legend>
			<div
				class="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1"
				role="radiogroup"
				aria-label="How to split"
			>
				{#each modes as mode (mode.value)}
					<label
						class="text-muted-foreground has-checked:bg-background has-checked:text-foreground flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition-all has-checked:shadow-sm"
					>
						<input
							type="radio"
							name="splitMode"
							value={mode.value}
							bind:group={form.splitMode}
							class="sr-only"
						/>
						{mode.label}
					</label>
				{/each}
			</div>
			<ul class="flex flex-col gap-1">
				{#each members as member (member.id)}
					{@const included = form.participants.includes(member.id)}
					<li class="flex min-h-12 items-center gap-3 rounded-xl px-1">
						{#if included}<input
								type="hidden"
								name="participants"
								value={member.id}
							/>{/if}
						<button
							type="button"
							role="checkbox"
							aria-checked={included}
							onclick={() => toggle(member.id)}
							class={cn(
								"flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
								included
									? "bg-primary border-primary text-primary-foreground"
									: "border-input",
							)}
						>
							{#if included}<CheckIcon class="size-4" />{/if}
							<span class="sr-only">Include {member.displayName}</span>
						</button>
						<span
							class={cn(
								"min-w-0 flex-1 truncate",
								!included && "text-muted-foreground",
							)}>{member.displayName}</span
						>
						{#if included && form.splitMode === "shares"}
							<Input
								name="weight:{member.id}"
								inputmode="numeric"
								aria-label="Shares for {member.displayName}"
								bind:value={form.weights[member.id]}
								class="h-10 w-16 text-center"
							/>
						{:else if included && form.splitMode === "exact"}
							<Input
								name="exact:{member.id}"
								inputmode="decimal"
								aria-label="Amount for {member.displayName}"
								placeholder="0"
								bind:value={form.exact[member.id]}
								class="h-10 w-28 text-right tabular"
							/>
						{/if}
						{#if included && form.splitMode !== "exact"}
							<span
								class="text-muted-foreground w-24 text-right text-sm tabular"
								>{formatMoney(preview.get(member.id) ?? 0, currency)}</span
							>
						{/if}
					</li>
				{/each}
			</ul>
			{#if form.splitMode === "exact" && exactGap !== 0 && totalMinor > 0}
				<p class="text-sm text-amber-600 dark:text-amber-400">
					{exactGap > 0
						? `${formatMoney(exactGap, currency)} left to assign`
						: `${formatMoney(-exactGap, currency)} too much`}
				</p>
			{/if}
			<Field.Error
				errors={errors.participants?.map((message) => ({ message }))}
			/>
		</fieldset>

		<Button type="submit" size="lg" class="glow h-12 rounded-xl text-base">
			{#if expense}<CheckIcon />{:else}<PlusIcon />{/if}
			{expense ? "Save expense" : "Add expense"}
		</Button>
	</form>
</ResponsiveSheet>
