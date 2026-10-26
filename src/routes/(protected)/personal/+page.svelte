<script lang="ts">
	import { page } from "$app/state";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import UsersIcon from "@lucide/svelte/icons/users";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	import { categoryOf } from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import ItemMenu, { type MenuAction } from "#lib/components/item-menu.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	import BanksCard from "./banks-card.svelte";
	import PersonalSheet, {
		type EditablePersonalExpense,
	} from "./personal-sheet.svelte";
	import ShareSheet from "./share-sheet.svelte";

	const { data } = $props();

	type Entry = (typeof data.expenses)[number];

	setPageTitle("Personal", undefined, [
		{ label: "Add expense", icon: PlusIcon, onSelect: openNew, primary: true },
	]);

	let sheetOpen = $state(false);
	let editing = $state<EditablePersonalExpense>();
	let shareOpen = $state(false);
	let sharing = $state<Entry>();

	const months = $derived.by(() => {
		const grouped = new Map<string, Entry[]>();
		for (const entry of data.expenses) {
			const month = entry.spentOn.slice(0, 7);
			grouped.set(month, [...(grouped.get(month) ?? []), entry]);
		}
		return [...grouped];
	});

	const thisMonth = $derived.by(() => {
		const month = new Date().toISOString().slice(0, 7);
		const entries = data.expenses.filter((entry) =>
			entry.spentOn.startsWith(month),
		);
		const byCategory = new Map<string, number>();
		for (const entry of entries.filter(
			(item) => item.currency === data.defaultCurrency,
		)) {
			byCategory.set(
				entry.category,
				(byCategory.get(entry.category) ?? 0) + entry.amountMinor,
			);
		}
		return {
			totals: totalsByCurrency(entries),
			categories: [...byCategory]
				.toSorted((left, right) => right[1] - left[1])
				.slice(0, 4),
		};
	});

	function totalsByCurrency(entries: Entry[]): string {
		const totals = new Map<string, number>();
		for (const entry of entries) {
			totals.set(
				entry.currency,
				(totals.get(entry.currency) ?? 0) + entry.amountMinor,
			);
		}
		return totals.size === 0
			? formatMoney(0, data.defaultCurrency)
			: [...totals]
					.map(([currency, minor]) => formatMoney(minor, currency))
					.join(" + ");
	}

	function monthLabel(month: string): string {
		return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, {
			month: "long",
			year: "numeric",
		});
	}

	function openNew() {
		editing = undefined;
		sheetOpen = true;
	}

	function actionsFor(entry: Entry): MenuAction[] {
		return [
			{
				label: "Edit",
				icon: PencilIcon,
				onSelect: () => {
					editing = entry;
					sheetOpen = true;
				},
			},
			...(data.shareGroups.length > 0 && !entry.sharedGroupId
				? [
						{
							label: "Split in a group",
							icon: UsersIcon,
							onSelect: () => {
								sharing = entry;
								shareOpen = true;
							},
						},
					]
				: []),
			{
				label: "Delete",
				icon: Trash2Icon,
				destructive: true,
				form: {
					action: "?/delete",
					fields: { id: entry.id },
					loading: "Deleting expense",
					success: "Expense deleted.",
					confirm: {
						title: `Delete "${entry.description}"?`,
						description: entry.sharedGroupName
							? `The copy in ${entry.sharedGroupName} stays.`
							: "Only you could see it.",
						confirmLabel: "Delete",
					},
				},
			},
		];
	}

	onMount(() => {
		const outcome = page.url.searchParams.get("bank");
		if (outcome === "connected") {
			toast.success("Bank linked. Its card payments show up in a moment.");
		} else if (outcome === "failed") {
			toast.error("The bank refused the link. Try again.");
		} else if (outcome === "cancelled") {
			toast.error("The bank link was cancelled.");
		}
	});
</script>

<div
	class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] xl:items-start"
>
	<div class="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24">
		<section class="glass rounded-2xl p-4 md:p-6" aria-label="This month">
			<p class="text-muted-foreground text-sm">Spent this month</p>
			<p class="font-display mt-1 text-3xl font-semibold tabular">
				{thisMonth.totals}
			</p>
			{#if thisMonth.categories.length > 0}
				<ul class="mt-4 flex flex-col gap-2 text-sm">
					{#each thisMonth.categories as [value, minor] (value)}
						{@const category = categoryOf(value)}
						<li class="flex items-center gap-2">
							<category.icon class="text-muted-foreground size-4" />
							<span class="flex-1">{category.label}</span>
							<span class="tabular"
								>{formatMoney(minor, data.defaultCurrency)}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="text-muted-foreground mt-4 text-xs">
				Only you see these. Split one in a group to share it.
			</p>
		</section>
		{#if data.bankSyncAvailable}
			<BanksCard connections={data.connections} />
		{/if}
	</div>

	<section aria-label="Personal expenses" class="min-w-0">
		{#if data.expenses.length === 0}
			<EmptyState
				icon={WalletIcon}
				title="Your own expenses"
				subtitle="Track what you spend on your own, apart from your groups.{data.bankSyncAvailable
					? ' Or link your bank to bring card payments in.'
					: ''}"
			>
				<Button size="lg" class="glow h-11 rounded-xl px-6" onclick={openNew}>
					<PlusIcon />
					Add expense
				</Button>
			</EmptyState>
		{:else}
			<div class="flex flex-col gap-6">
				{#each months as [month, entries] (month)}
					<div>
						<h2
							class="text-muted-foreground mb-2 flex items-baseline justify-between px-1 text-sm font-medium"
						>
							<span>{monthLabel(month)}</span>
							<span class="tabular">{totalsByCurrency(entries)}</span>
						</h2>
						<ul
							class="glass divide-border divide-y overflow-hidden rounded-2xl"
						>
							{#each entries as entry (entry.id)}
								{@const category = categoryOf(entry.category)}
								<li>
									<ItemMenu
										title={entry.description}
										class="min-h-16 px-3 py-2 md:px-4"
										actions={actionsFor(entry)}
									>
										<span
											class="bg-accent text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-xl"
										>
											<category.icon class="size-5" />
										</span>
										<span class="min-w-0 flex-1">
											<span class="block truncate font-medium"
												>{entry.description}</span
											>
											<span
												class="text-muted-foreground flex items-center gap-1 truncate text-sm"
											>
												{#if entry.fromBank}<LandmarkIcon
														class="size-3.5 shrink-0"
													/>{/if}
												{entry.sharedGroupName
													? `Split in ${entry.sharedGroupName}`
													: new Date(
															`${entry.spentOn}T12:00:00`,
														).toLocaleDateString(undefined, {
															day: "numeric",
															month: "short",
														})}
											</span>
										</span>
										<span class="font-display font-semibold tabular"
											>{formatMoney(entry.amountMinor, entry.currency)}</span
										>
									</ItemMenu>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<Fab label="Add expense" icon={PlusIcon} onclick={openNew} />

<PersonalSheet
	bind:open={sheetOpen}
	defaultCurrency={data.defaultCurrency}
	expense={editing}
/>

{#if sharing}
	<ShareSheet
		bind:open={shareOpen}
		expense={sharing}
		groups={data.shareGroups}
	/>
{/if}
