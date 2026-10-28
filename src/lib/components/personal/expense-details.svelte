<script lang="ts">
	import PencilIcon from "@lucide/svelte/icons/pencil";

	import {
		categoryOf,
		categoryStyle,
		type CustomCategory,
	} from "#lib/categories.js";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import type { PersonalExpenseRow } from "#lib/dto/personal-expense.js";
	import { formatMoney } from "#lib/money.js";
	import { spendingKind } from "#lib/spending-kind.js";

	interface Props {
		open: boolean;
		expense: PersonalExpenseRow | undefined;
		account: string | undefined;
		categories: CustomCategory[];
		onEdit: () => void;
	}

	let {
		open = $bindable(),
		expense,
		account,
		categories,
		onEdit,
	}: Props = $props();

	const category = $derived(
		expense ? categoryOf(expense.category, categories) : undefined,
	);
	const counts = $derived.by(() => {
		if (!expense) {
			return "";
		}
		if (expense.category === "internal") {
			return "Moved between your own accounts: left out of spent and income";
		}
		return {
			spent: "Counts as spent",
			finance: "Loans, fees and cash: kept out of spent",
			aside: "Set aside, not spent",
			income: "Counts as income",
		}[spendingKind(expense) ?? "aside"];
	});
</script>

<ResponsiveSheet bind:open title={expense?.description ?? ""}>
	{#if expense && category}
		<div class="flex flex-col gap-5 pb-4">
			<div>
				<p
					class="font-display text-3xl font-semibold tabular {expense.kind ===
					'income'
						? 'text-positive'
						: ''}"
				>
					{expense.kind === "income" ? "+" : ""}{formatMoney(
						expense.amountMinor,
						expense.currency,
					)}
				</p>
				<p class="text-muted-foreground mt-1 text-sm">{counts}</p>
			</div>
			<dl class="divide-border divide-y text-sm">
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-muted-foreground">Date</dt>
					<dd class="text-right font-medium">
						{new Date(`${expense.spentOn}T12:00:00`).toLocaleDateString(
							undefined,
							{
								weekday: "long",
								day: "numeric",
								month: "long",
								year: "numeric",
							},
						)}
					</dd>
				</div>
				<div class="flex items-center justify-between gap-4 py-3">
					<dt class="text-muted-foreground">Category</dt>
					<dd class="flex items-center gap-2 font-medium">
						<span
							class="category-tile flex size-7 items-center justify-center rounded-lg"
							style={categoryStyle(category)}
						>
							<category.icon class="size-4" />
						</span>
						{category.label}
					</dd>
				</div>
				{#if expense.fromBank}
					<div class="flex items-center justify-between gap-4 py-3">
						<dt class="text-muted-foreground">Account</dt>
						<dd class="min-w-0 truncate text-right font-medium">
							{account ?? expense.bankName ?? "A linked bank"}
						</dd>
					</div>
				{/if}
				{#if expense.folderName}
					<div class="flex items-center justify-between gap-4 py-3">
						<dt class="text-muted-foreground">Folder</dt>
						<dd class="min-w-0 truncate text-right font-medium">
							{expense.folderName}
						</dd>
					</div>
				{/if}
				{#if expense.sharedGroupName}
					<div class="flex items-center justify-between gap-4 py-3">
						<dt class="text-muted-foreground">Split in</dt>
						<dd class="min-w-0 truncate text-right font-medium">
							{expense.sharedGroupName}
						</dd>
					</div>
				{/if}
				{#if expense.note}
					<div class="flex flex-col gap-1 py-3">
						<dt class="text-muted-foreground">Note</dt>
						<dd class="whitespace-pre-line">{expense.note}</dd>
					</div>
				{/if}
			</dl>
			<Button
				variant="secondary"
				class="h-11 rounded-xl"
				onclick={() => {
					open = false;
					onEdit();
				}}
			>
				<PencilIcon />
				Edit
			</Button>
		</div>
	{/if}
</ResponsiveSheet>
