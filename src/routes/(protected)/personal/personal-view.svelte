<script lang="ts">
	import { resolve } from "$app/paths";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import UsersIcon from "@lucide/svelte/icons/users";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import type { Snippet } from "svelte";

	import { categoryOf, categoryStyle } from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import ItemMenu, { type MenuAction } from "#lib/components/item-menu.svelte";
	import LoadedFromHere from "#lib/components/loaded-from-here.svelte";
	import SimilarSheet, {
		type SimilarExpense,
	} from "#lib/components/similar-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import type {
		MoneyTotal,
		PersonalExpenseRow,
		PersonalStats,
	} from "#lib/dto/personal-expense.js";
	import { listBlocks } from "#lib/list-blocks.js";
	import { formatMoney } from "#lib/money.js";

	import PersonalSheet, {
		type EditablePersonalExpense,
	} from "./personal-sheet.svelte";
	import ShareSheet from "./share-sheet.svelte";

	interface Props {
		expenses: PersonalExpenseRow[];
		hasMore: boolean;
		matching: number;
		pageSize: number;
		stats: PersonalStats;
		folders: { id: string; name: string }[];
		shareGroups: { id: string; name: string; currency: string }[];
		defaultCurrency: string;
		folder?: { id: string; name: string };
		empty: string;
		adding: boolean;
		aside?: Snippet;
	}

	let {
		expenses,
		hasMore,
		matching,
		pageSize,
		stats,
		folders,
		shareGroups,
		defaultCurrency,
		folder,
		empty,
		adding = $bindable(),
		aside,
	}: Props = $props();

	const action = resolve("/(protected)/personal");

	let leftOff = $state<number>();

	let editing = $state<EditablePersonalExpense>();
	let shareOpen = $state(false);
	let sharing = $state<PersonalExpenseRow>();
	let similarOpen = $state(false);
	let similar = $state<{
		category: { value: string; label: string };
		expenses: SimilarExpense[];
	}>();

	$effect(() => {
		if (!adding) {
			editing = undefined;
		}
	});

	const months = $derived(
		listBlocks(expenses, (entry) => entry.spentOn.slice(0, 7), leftOff),
	);

	const topCategories = $derived(
		stats.byCategory
			.filter((row) => row.currency === defaultCurrency)
			.slice(0, 5),
	);
	const largestCategory = $derived(
		Math.max(1, ...topCategories.map((row) => row.minor)),
	);

	function totals(rows: MoneyTotal[]): string {
		return rows.length === 0
			? formatMoney(0, defaultCurrency)
			: rows.map((row) => formatMoney(row.minor, row.currency)).join(" + ");
	}

	function monthTotal(month: string): string {
		return totals(stats.byMonth.filter((row) => row.month === month));
	}

	function monthLabel(month: string): string {
		return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, {
			month: "long",
			year: "numeric",
		});
	}

	function reviewSimilar(result: Record<string, unknown> | undefined) {
		const found = (result?.similar ?? []) as SimilarExpense[];
		const category = String(result?.category ?? "");
		if (found.length === 0 || !category) {
			return;
		}
		similar = {
			category: { value: category, label: categoryOf(category).label },
			expenses: found,
		};
		similarOpen = true;
	}

	function actionsFor(entry: PersonalExpenseRow): MenuAction[] {
		return [
			{
				label: "Edit",
				icon: PencilIcon,
				onSelect: () => {
					editing = entry;
					adding = true;
				},
			},
			...(shareGroups.length > 0 && !entry.sharedGroupId
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
					action: `${action}?/delete`,
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

	function detail(entry: PersonalExpenseRow): string {
		if (entry.sharedGroupName) {
			return `Split in ${entry.sharedGroupName}`;
		}
		const day = new Date(`${entry.spentOn}T12:00:00`).toLocaleDateString(
			undefined,
			{ day: "numeric", month: "short" },
		);
		return !folder && entry.folderName ? `${day} · ${entry.folderName}` : day;
	}
</script>

<div
	class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] xl:items-start"
>
	<div class="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24">
		<section class="glass rounded-2xl p-4 md:p-6" aria-label="Totals">
			<p class="text-muted-foreground text-sm">
				{folder ? "Spent in all" : "Spent this month"}
			</p>
			<p class="font-display mt-1 text-3xl font-semibold tabular">
				{totals(folder ? stats.totals : stats.thisMonth)}
			</p>
			{#if folder && stats.thisMonth.length > 0}
				<p class="text-muted-foreground mt-1 text-sm">
					{totals(stats.thisMonth)} this month
				</p>
			{/if}
			{#if topCategories.length > 0}
				<ul class="mt-4 flex flex-col gap-2.5 text-sm" aria-label="By category">
					{#each topCategories as row (row.category)}
						{@const category = categoryOf(row.category)}
						<li class="flex flex-col gap-1">
							<span class="flex items-center gap-2">
								<span
									class="category-tile flex size-6 items-center justify-center rounded-md"
									style={categoryStyle(category)}
								>
									<category.icon class="size-3.5" />
								</span>
								<span class="flex-1">{category.label}</span>
								<span class="tabular"
									>{formatMoney(row.minor, row.currency)}</span
								>
							</span>
							<span
								class="bg-muted h-1.5 overflow-hidden rounded-full"
								aria-hidden="true"
							>
								<span
									class="category-bar block h-full rounded-full"
									style="width: {Math.max(
										2,
										(row.minor / largestCategory) * 100,
									)}%; {categoryStyle(category)}"
								></span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="text-muted-foreground mt-4 text-xs">
				Only you see these. Split one in a group to share it.
			</p>
		</section>
		{@render aside?.()}
	</div>

	<section aria-label="Expenses" class="min-w-0">
		{#if expenses.length === 0}
			<EmptyState
				icon={folder ? FolderIcon : WalletIcon}
				title={folder ? `Nothing in ${folder.name} yet` : "Your own expenses"}
				subtitle={empty}
			>
				<Button
					size="lg"
					class="glow h-11 rounded-xl px-6"
					onclick={() => (adding = true)}
				>
					<PlusIcon />
					Add expense
				</Button>
			</EmptyState>
		{:else}
			<div class="flex flex-col gap-6">
				{#each months as block (block.key)}
					{#if block.loadedFromHere}<LoadedFromHere />{/if}
					<div>
						{#if block.heading}
							<h2
								class="text-muted-foreground mb-2 flex items-baseline justify-between px-1 text-sm font-medium"
							>
								<span>{monthLabel(block.group)}</span>
								<span class="tabular">{monthTotal(block.group)}</span>
							</h2>
						{/if}
						<ul
							class="glass divide-border divide-y overflow-hidden rounded-2xl"
						>
							{#each block.entries as entry (entry.id)}
								{@const category = categoryOf(entry.category)}
								<li>
									<ItemMenu
										title={entry.description}
										class="min-h-16 px-3 py-2 md:px-4"
										actions={actionsFor(entry)}
									>
										<span
											class="category-tile flex size-11 shrink-0 items-center justify-center rounded-xl"
											style={categoryStyle(category)}
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
												{detail(entry)}
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
				{#if hasMore}
					<div class="self-center" data-sveltekit-reset="false">
						<Button
							href="?limit={expenses.length + pageSize}"
							onclick={() => (leftOff = expenses.length)}
							variant="secondary"
							class="h-11 rounded-xl px-6"
						>
							Load more
							<span class="text-muted-foreground tabular"
								>({expenses.length} of {matching})</span
							>
						</Button>
					</div>
				{/if}
			</div>
		{/if}
	</section>
</div>

<Fab label="Add expense" icon={PlusIcon} onclick={() => (adding = true)} />

<PersonalSheet
	bind:open={adding}
	{action}
	{defaultCurrency}
	{folders}
	defaultFolderId={folder?.id ?? null}
	expense={editing}
	onSaved={reviewSimilar}
/>

{#if sharing}
	<ShareSheet
		bind:open={shareOpen}
		expense={sharing}
		groups={shareGroups}
		{action}
	/>
{/if}

{#if similar}
	<SimilarSheet
		bind:open={similarOpen}
		category={similar.category}
		expenses={similar.expenses}
		action="{action}?/applyCategory"
	/>
{/if}
