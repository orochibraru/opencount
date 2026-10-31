<script lang="ts">
	import { deserialize, enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import ArchiveIcon from "@lucide/svelte/icons/archive";
	import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";
	import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
	import ChartColumnIcon from "@lucide/svelte/icons/chart-column";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import RepeatIcon from "@lucide/svelte/icons/repeat";
	import SearchIcon from "@lucide/svelte/icons/search";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import Share2Icon from "@lucide/svelte/icons/share-2";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
	import { toast } from "svelte-sonner";

	import {
		categoryOf,
		categoryOptions,
		categoryStyle,
	} from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import BalanceHero from "#lib/components/groups/balance-hero.svelte";
	import ExpenseSheet, {
		type EditableExpense,
	} from "#lib/components/groups/expense-sheet.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import ListFilters, {
		type FilterChange,
	} from "#lib/components/list-filters.svelte";
	import LoadedFromHere from "#lib/components/loaded-from-here.svelte";
	import SimilarSheet, {
		type SimilarExpense,
	} from "#lib/components/similar-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { alternatives, appendAll } from "#lib/filter-params.js";
	import { listBlocks } from "#lib/list-blocks.js";
	import { formatMoney } from "#lib/money.js";
	import { offlineQueue } from "#lib/offline-queue.svelte.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast, toastError } from "#lib/toast.js";

	const { data } = $props();

	setPageTitle(
		() => data.group.name,
		() => resolve("/(protected)"),
		() => [
			{
				label: "Add expense",
				icon: PlusIcon,
				onSelect: openNew,
				primary: true,
			},
			{
				label: "Insights",
				icon: ChartColumnIcon,
				href: resolve("/(protected)/groups/[groupId]/analytics", {
					groupId: data.group.id,
				}),
			},
			{
				label: "Settings",
				icon: SettingsIcon,
				href: resolve("/(protected)/groups/[groupId]/settings", {
					groupId: data.group.id,
				}),
			},
			{
				label: "Invite people",
				icon: Share2Icon,
				onSelect: handleShare,
			},
		],
	);

	async function shareCallback(): Promise<string> {
		const response = await fetch("?/inviteLink", {
			method: "POST",
			body: new FormData(),
			headers: { "x-sveltekit-action": "true" },
		});
		const result = deserialize(await response.text());
		if (result.type !== "success") {
			throw new Error("Couldn't make an invite link.");
		}
		const url = String(result.data?.url);
		if ("share" in navigator) {
			try {
				await navigator.share({
					title: data.group.name,
					text: `Join ${data.group.name} on OpenCount`,
					url,
				});
				return "Invite link shared.";
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return "Invite link ready.";
				}
			}
		}
		await navigator.clipboard.writeText(url);
		return "Invite link copied.";
	}

	function handleShare() {
		toast.promise(shareCallback(), {
			loading: "Getting the invite link",
			success: (message: string) => message,
			error: (error: unknown) => toastError(error, "Couldn't share the link."),
		});
	}

	const waiting = $derived(
		offlineQueue.pending.filter((entry) => entry.groupId === data.group.id),
	);

	let sheetOpen = $state(false);

	let leftOff = $state<number>();
	let editing = $state<EditableExpense | undefined>();

	const names = $derived(
		new Map(data.members.map((member) => [member.id, member.displayName])),
	);
	const merchantNames = $derived(
		new Map(data.merchants.map((merchant) => [merchant.id, merchant.name])),
	);
	const days = $derived(
		listBlocks(data.expenses, (entry) => entry.spentOn, leftOff),
	);
	let similarOpen = $state(false);
	let similar = $state<{
		category: { value: string; label: string };
		expenses: SimilarExpense[];
	}>();

	const filterOptions = $derived(categoryOptions(data.categories));
	const activeCategories = $derived(
		data.categoryFilter.map((value) => categoryOf(value, data.categories)),
	);
	const merchantSources = $derived(
		data.merchants.map((entry) => ({ value: entry.id, label: entry.name })),
	);
	const activeMerchants = $derived(
		merchantSources.filter((entry) =>
			data.merchantFilter.includes(entry.value),
		),
	);
	const filtered = $derived(
		activeCategories.length > 0 ||
			activeMerchants.length > 0 ||
			data.search !== "",
	);
	const underCategories = $derived(
		alternatives(activeCategories.map((option) => option.label)),
	);
	const atMerchants = $derived(
		alternatives(activeMerchants.map((entry) => entry.label)),
	);

	function listHref(change: FilterChange & { limit?: number }): string {
		const params = new URLSearchParams();
		appendAll(params, "category", change.categories ?? data.categoryFilter);
		appendAll(params, "merchant", change.merchants ?? data.merchantFilter);
		const search = change.search ?? data.search;
		if (search) {
			params.set("q", search);
		}
		if (change.limit) {
			params.set("limit", String(change.limit));
		}
		const query = params.toString();
		return query ? `?${query}` : "?";
	}

	function reviewSimilar(result: Record<string, unknown> | undefined) {
		const found = (result?.similar ?? []) as Omit<SimilarExpense, "currency">[];
		const category = String(result?.category ?? "");
		if (found.length === 0 || !category) {
			return;
		}
		const option = categoryOf(category, data.categories);
		similar = {
			category: { value: category, label: option.label },
			expenses: found.map((entry) => ({
				...entry,
				currency: data.group.currency,
			})),
		};
		similarOpen = true;
	}

	function dayLabel(day: string): string {
		const date = new Date(`${day}T12:00:00`);
		const today = new Date();
		const yesterday = new Date(Date.now() - 86_400_000);
		if (date.toDateString() === today.toDateString()) {
			return "Today";
		}
		if (date.toDateString() === yesterday.toDateString()) {
			return "Yesterday";
		}
		return date.toLocaleDateString(undefined, {
			weekday: "long",
			day: "numeric",
			month: "long",
		});
	}

	function myShare(entry: (typeof data.expenses)[number]): number {
		return (
			entry.shares.find((share) => share.memberId === data.myMemberId)
				?.amountMinor ?? 0
		);
	}

	function openNew() {
		editing = undefined;
		sheetOpen = true;
	}

	function openEdit(entry: (typeof data.expenses)[number]) {
		editing = entry;
		sheetOpen = true;
	}
</script>

{#if data.group.archived}
	<form
		method="POST"
		action="{resolve('/(protected)/groups/[groupId]/settings/general', {
			groupId: data.group.id,
		})}?/setArchived"
		class="glass mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
		use:enhance={enhanceToast({
			loading: "Bringing it back",
			success: "Back in your groups.",
		})}
	>
		<ArchiveIcon class="text-muted-foreground size-4 shrink-0" />
		<span class="flex-1"
			>You archived this group, so it's hidden from your list.</span
		>
		<input type="hidden" name="archived" value="false" />
		<Button type="submit" variant="outline" size="sm" class="rounded-lg">
			<ArchiveRestoreIcon />
			Unarchive
		</Button>
	</form>
{/if}

<div
	class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] xl:items-start"
>
	<div class="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24">
		<BalanceHero
			balanceMinor={data.matchingTotals?.balanceMinor ??
				(data.myMemberId ? (data.balances[data.myMemberId] ?? 0) : 0)}
			totalSpentMinor={data.matchingTotals?.spentMinor ?? data.totalSpent}
			scope={data.matchingTotals
				? `In these ${data.matching} ${data.matching === 1 ? "result" : "results"}`
				: undefined}
			currency={data.group.currency}
			memberCount={data.members.length}
			balancesHref={resolve("/(protected)/groups/[groupId]/balances", {
				groupId: data.group.id,
			})}
		/>
	</div>

	<section aria-label="Expenses" class="min-w-0">
		{#if waiting.length > 0}
			<p
				class="glass mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
			>
				<WifiOffIcon class="text-muted-foreground size-4 shrink-0" />
				{waiting.length === 1
					? `"${waiting[0]?.description}" is saved on this device and is added once you're back online.`
					: `${waiting.length} expenses are saved on this device and are added once you're back online.`}
			</p>
		{/if}
		{#if data.matching > 0 || filtered}
			<ListFilters
				search={data.search}
				options={filterOptions}
				categories={data.categoryFilter}
				merchants={merchantSources}
				activeMerchants={data.merchantFilter}
				href={listHref}
			/>
			{#if filtered}
				<p class="text-muted-foreground mb-3 px-1 text-sm">
					{data.matching}
					{data.matching === 1 ? "expense" : "expenses"}
				</p>
			{/if}
		{/if}
		{#if data.expenses.length === 0 && filtered}
			<EmptyState
				icon={(activeCategories.length === 1
					? activeCategories[0]?.icon
					: undefined) ?? SearchIcon}
				title="No expense matches"
				subtitle={data.search
					? `Nothing with "${data.search}"${underCategories ? ` under ${underCategories}` : ""}.`
					: underCategories
						? `No expense is filed under ${underCategories}${atMerchants ? ` at ${atMerchants}` : ""}.`
						: `No expense at ${atMerchants}.`}
			/>
		{:else if data.expenses.length === 0}
			<EmptyState
				icon={ReceiptIcon}
				title="No expenses yet"
				subtitle="Add the first one: who paid, how much, and who it was for."
			>
				<Button size="lg" class="glow h-11 rounded-xl px-6" onclick={openNew}>
					<PlusIcon />
					Add expense
				</Button>
			</EmptyState>
		{:else}
			<div class="flex flex-col gap-6">
				{#each days as block (block.key)}
					{#if block.loadedFromHere}<LoadedFromHere />{/if}
					<div>
						{#if block.heading}
							<h2 class="text-muted-foreground mb-2 px-1 text-sm font-medium">
								{dayLabel(block.group)}
							</h2>
						{/if}
						<ul
							class="glass divide-border divide-y overflow-hidden rounded-2xl"
						>
							{#each block.entries as entry (entry.id)}
								{@const category = categoryOf(entry.category, data.categories)}
								{@const share = myShare(entry)}
								<li>
									<ItemMenu
										title={entry.description}
										class="min-h-18 px-3 py-2.5 md:px-4"
										actions={[
											{
												label: "Edit",
												icon: PencilIcon,
												onSelect: () => openEdit(entry),
											},
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
														description:
															"Everyone's balance updates right away.",
														confirmLabel: "Delete",
													},
												},
											},
										]}
									>
										<button
											type="button"
											class="flex min-w-0 flex-1 items-center gap-3 text-left"
											onclick={() => openEdit(entry)}
										>
											<span
												class="category-tile flex size-11 shrink-0 items-center justify-center rounded-xl"
												style={entry.kind === "transfer"
													? "--category-chroma: 0"
													: categoryStyle(category)}
											>
												{#if entry.kind === "transfer"}
													<ArrowLeftRightIcon class="size-5" />
												{:else}
													<category.icon class="size-5" />
												{/if}
											</span>
											<span class="min-w-0 flex-1">
												<span class="flex items-center gap-1.5 font-medium">
													<span class="truncate">{entry.description}</span>
													{#if entry.recurringId}
														<RepeatIcon
															class="text-muted-foreground size-3.5 shrink-0"
															aria-label="Repeats"
														/>
													{/if}
												</span>
												<span
													class="text-muted-foreground block truncate text-sm"
												>
													{entry.kind === "transfer"
														? `${names.get(entry.paidBy)} paid ${names.get(entry.shares[0]?.memberId ?? "")}`
														: `${names.get(entry.paidBy) ?? "Someone"} paid${entry.merchantId && merchantNames.has(entry.merchantId) ? ` at ${merchantNames.get(entry.merchantId)}` : ""}`}
												</span>
											</span>
											<span class="text-right">
												<span class="font-display block font-semibold tabular"
													>{formatMoney(
														entry.amountMinor,
														data.group.currency,
													)}</span
												>
												{#if entry.originalCurrency && entry.originalAmountMinor !== null}
													<span
														class="text-muted-foreground block text-xs tabular"
														>{formatMoney(
															entry.originalAmountMinor,
															entry.originalCurrency,
														)}</span
													>
												{:else if entry.kind === "expense" && share > 0}
													<span
														class="text-muted-foreground block text-xs tabular"
														>Your share {formatMoney(
															share,
															data.group.currency,
														)}</span
													>
												{/if}
											</span>
										</button>
									</ItemMenu>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
				{#if data.hasMore}
					<div class="self-center" data-sveltekit-reset="false">
						<Button
							href={listHref({
								limit: data.expenses.length + data.pageSize,
							})}
							onclick={() => (leftOff = data.expenses.length)}
							variant="secondary"
							class="h-11 rounded-xl px-6"
						>
							Load more
							<span class="text-muted-foreground tabular"
								>({data.expenses.length} of {data.matching})</span
							>
						</Button>
					</div>
				{/if}
			</div>
		{/if}
	</section>
</div>

{#if similar}
	<SimilarSheet
		bind:open={similarOpen}
		category={similar.category}
		expenses={similar.expenses}
	/>
{/if}

<Fab label="Add expense" icon={PlusIcon} onclick={openNew} />

<ExpenseSheet
	bind:open={sheetOpen}
	currency={data.group.currency}
	members={data.members}
	merchants={data.merchants}
	categories={data.categories}
	receiptsEnabled={data.receiptsEnabled}
	defaultPayer={data.myMemberId}
	expense={editing}
	onSaved={reviewSimilar}
/>
