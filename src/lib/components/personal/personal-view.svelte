<script lang="ts">
	import { resolve } from "$app/paths";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import FolderInputIcon from "@lucide/svelte/icons/folder-input";
	import HandCoinsIcon from "@lucide/svelte/icons/hand-coins";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PiggyBankIcon from "@lucide/svelte/icons/piggy-bank";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import SearchIcon from "@lucide/svelte/icons/search";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import UsersIcon from "@lucide/svelte/icons/users";
	import WalletIcon from "@lucide/svelte/icons/wallet";
	import type { Snippet } from "svelte";

	import {
		categoryOf,
		categoryOptions,
		categoryStyle,
		type CustomCategory,
	} from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import ItemMenu, { type MenuAction } from "#lib/components/item-menu.svelte";
	import ListFilters, {
		type FilterChange,
		type FilterSource,
	} from "#lib/components/list-filters.svelte";
	import LoadedFromHere from "#lib/components/loaded-from-here.svelte";
	import BankPills from "#lib/components/personal/bank-pills.svelte";
	import ExpenseDetails from "#lib/components/personal/expense-details.svelte";
	import MoveSheet from "#lib/components/personal/move-sheet.svelte";
	import PersonalSheet, {
		type EditablePersonalExpense,
	} from "#lib/components/personal/personal-sheet.svelte";
	import ShareSheet from "#lib/components/personal/share-sheet.svelte";
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
	import { monthLabel, monthStartOn } from "#lib/pay-month.js";

	interface Props {
		expenses: PersonalExpenseRow[];
		hasMore: boolean;
		matching: number;
		pageSize: number;
		stats: PersonalStats;
		monthStartDay: number;
		categories: CustomCategory[];
		category: string | null;
		search: string;
		accounts: { uid: string; name: string; bankId: string; bankName: string }[];
		bank: string | null;
		account: string | null;
		folders: { id: string; name: string }[];
		banks?: {
			id: string;
			bankName: string;
			bankLogo: string | null;
			failed: boolean;
			syncing: boolean;
		}[];
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
		monthStartDay,
		categories,
		category,
		search,
		accounts,
		bank,
		account,
		folders,
		banks = [],
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
	let viewing = $state<PersonalExpenseRow>();
	let detailsOpen = $state(false);
	let shareOpen = $state(false);
	let sharing = $state<PersonalExpenseRow>();
	let moveOpen = $state(false);
	let moving = $state<PersonalExpenseRow>();
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

	const activeCategory = $derived(
		category ? categoryOf(category, categories) : undefined,
	);
	const sources = $derived<FilterSource[]>(
		accounts.length < 2
			? []
			: [...new Set(accounts.map((entry) => entry.bankId))].flatMap(
					(bankId) => {
						const own = accounts.filter((entry) => entry.bankId === bankId);
						return [
							{ value: `bank:${bankId}`, label: own[0]?.bankName ?? "Bank" },
							...(own.length > 1
								? own.map((entry) => ({
										value: `account:${entry.uid}`,
										label: entry.name,
										indent: true,
									}))
								: []),
						];
					},
				),
	);
	const currentSource = $derived(
		account ? `account:${account}` : bank ? `bank:${bank}` : null,
	);
	const activeSource = $derived(
		sources.find((source) => source.value === currentSource),
	);
	const folderOptions = $derived(
		folders.map((entry) => ({ value: entry.id, label: entry.name })),
	);
	const activeFolder = $derived(
		folderOptions.find((entry) => entry.value === folder?.id),
	);
	const filtered = $derived(
		activeCategory !== undefined || search !== "" || currentSource !== null,
	);

	function listHref(change: FilterChange & { limit?: number }): string {
		const params = new URLSearchParams();
		const folderId = change.folder === undefined ? folder?.id : change.folder;
		const base = folderId
			? resolve("/(protected)/personal/folders/[folderId]", { folderId })
			: action;
		const wanted = change.category === undefined ? category : change.category;
		const source = change.source === undefined ? currentSource : change.source;
		const text = change.search ?? search;
		if (wanted) {
			params.set("category", wanted);
		}
		if (source?.startsWith("bank:")) {
			params.set("bank", source.slice(5));
		} else if (source?.startsWith("account:")) {
			params.set("account", source.slice(8));
		}
		if (text) {
			params.set("q", text);
		}
		if (change.limit) {
			params.set("limit", String(change.limit));
		}
		const query = params.toString();
		return query ? `${base}?${query}` : base;
	}

	function sourceOf(entry: PersonalExpenseRow): string | undefined {
		if (accounts.length < 2 || !entry.bankAccountUid) {
			return undefined;
		}
		const match = accounts.find((item) => item.uid === entry.bankAccountUid);
		return match
			? `${match.bankName} ${match.name}`
			: (entry.bankName ?? undefined);
	}

	const months = $derived(
		listBlocks(
			expenses,
			(entry) => monthStartOn(entry.spentOn, monthStartDay),
			leftOff,
		),
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

	function reviewSimilar(result: Record<string, unknown> | undefined) {
		const found = (result?.similar ?? []) as SimilarExpense[];
		const category = String(result?.category ?? "");
		if (found.length === 0 || !category) {
			return;
		}
		similar = {
			category: {
				value: category,
				label: categoryOf(category, categories).label,
			},
			expenses: found,
		};
		similarOpen = true;
	}

	function edit(entry: PersonalExpenseRow) {
		editing = entry;
		adding = true;
	}

	const viewingAccount = $derived.by(() => {
		const match = accounts.find((item) => item.uid === viewing?.bankAccountUid);
		return match ? `${match.bankName} · ${match.name}` : undefined;
	});

	function view(entry: PersonalExpenseRow) {
		viewing = entry;
		detailsOpen = true;
	}

	function actionsFor(entry: PersonalExpenseRow): MenuAction[] {
		return [
			{
				label: "Edit",
				icon: PencilIcon,
				onSelect: () => edit(entry),
			},
			...(folders.length > 0
				? [
						{
							label: "Move to folder",
							icon: FolderInputIcon,
							onSelect: () => {
								moving = entry;
								moveOpen = true;
							},
						},
					]
				: []),
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
		return [
			entry.aside ? "Set aside" : day,
			!folder ? entry.folderName : null,
			sourceOf(entry),
		]
			.filter(Boolean)
			.join(" · ");
	}
</script>

{#if banks.length > 0}
	<BankPills
		{banks}
		active={account ? null : bank}
		href={(bankId) => listHref({ source: bankId ? `bank:${bankId}` : null })}
	/>
{/if}

<div
	class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] xl:items-start"
>
	<div class="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24">
		<section class="glass rounded-2xl p-4 md:p-6" aria-label="Totals">
			{#if filtered}
				<p
					class="bg-muted text-muted-foreground mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
				>
					In these {matching}
					{matching === 1 ? "result" : "results"}
				</p>
			{/if}
			<p class="text-muted-foreground text-sm">
				{folder || filtered ? "Spent in all" : "Spent this month"}
			</p>
			<p class="font-display mt-1 text-3xl font-semibold tabular">
				{totals(folder || filtered ? stats.totals : stats.thisMonth)}
			</p>
			{#if (folder || filtered) && stats.thisMonth.length > 0}
				<p class="text-muted-foreground mt-1 text-sm">
					{totals(stats.thisMonth)} this month
				</p>
			{/if}
			{#if (folder || filtered ? stats.aside : stats.asideThisMonth).length > 0}
				<p class="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
					<PiggyBankIcon class="size-4 shrink-0" />
					{totals(folder || filtered ? stats.aside : stats.asideThisMonth)} set aside{folder ||
					filtered
						? ""
						: " this month"}, not spent
				</p>
			{/if}
			{#if (folder || filtered ? stats.finance : stats.financeThisMonth).length > 0}
				<p class="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
					<LandmarkIcon class="size-4 shrink-0" />
					{totals(folder || filtered ? stats.finance : stats.financeThisMonth)} in
					loans, fees and cash{folder || filtered ? "" : " this month"}, apart
				</p>
			{/if}
			{#if (folder || filtered ? stats.income : stats.incomeThisMonth).length > 0}
				<p class="text-positive mt-1 flex items-center gap-1.5 text-sm">
					<HandCoinsIcon class="size-4 shrink-0" />
					+{totals(folder || filtered ? stats.income : stats.incomeThisMonth)} came
					in{folder || filtered ? "" : " this month"}
				</p>
			{/if}
			{#if topCategories.length > 0}
				<ul class="mt-4 flex flex-col gap-2.5 text-sm" aria-label="By category">
					{#each topCategories as row (row.category)}
						{@const category = categoryOf(row.category, categories)}
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
		{#if matching > 0 || filtered}
			<ListFilters
				{search}
				active={activeCategory}
				options={categoryOptions(categories)}
				{sources}
				{activeSource}
				folders={folderOptions}
				{activeFolder}
				href={listHref}
			/>
			{#if filtered}
				<p class="text-muted-foreground mb-3 px-1 text-sm">
					{matching}
					{matching === 1 ? "expense" : "expenses"}
				</p>
			{/if}
		{/if}
		{#if expenses.length === 0 && filtered}
			<EmptyState
				icon={activeCategory?.icon ?? SearchIcon}
				title="No expense matches"
				subtitle={search
					? `Nothing with "${search}"${activeCategory ? ` under ${activeCategory.label}` : ""}.`
					: `No expense is filed under ${activeCategory?.label}.`}
			/>
		{:else if expenses.length === 0}
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
								{@const category = categoryOf(entry.category, categories)}
								<li>
									<ItemMenu
										title={entry.description}
										class="min-h-16 px-3 py-2 md:px-4"
										actions={actionsFor(entry)}
										onOpen={() => view(entry)}
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
												{#if entry.aside}<PiggyBankIcon
														class="size-3.5 shrink-0"
													/>{:else if entry.fromBank}<LandmarkIcon
														class="size-3.5 shrink-0"
													/>{/if}
												{detail(entry)}
											</span>
											{#if entry.note}
												<span
													class="text-muted-foreground block truncate text-sm italic"
													>{entry.note}</span
												>
											{/if}
										</span>
										<span
											class="font-display font-semibold tabular {entry.aside
												? 'text-muted-foreground'
												: entry.kind === 'income'
													? 'text-positive'
													: ''}"
											>{entry.kind === "income" ? "+" : ""}{formatMoney(
												entry.amountMinor,
												entry.currency,
											)}</span
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
							href={listHref({ limit: expenses.length + pageSize })}
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

<ExpenseDetails
	bind:open={detailsOpen}
	expense={viewing}
	account={viewingAccount}
	{categories}
	onEdit={() => {
		if (viewing) {
			edit(viewing);
		}
	}}
/>

<PersonalSheet
	bind:open={adding}
	{action}
	{defaultCurrency}
	{folders}
	{categories}
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

{#if moving}
	<MoveSheet bind:open={moveOpen} expense={moving} {folders} {action} />
{/if}

{#if similar}
	<SimilarSheet
		bind:open={similarOpen}
		category={similar.category}
		expenses={similar.expenses}
		action="{action}?/applyCategory"
	/>
{/if}
