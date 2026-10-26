<script lang="ts">
	import { deserialize, enhance } from "$app/forms";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import ArchiveIcon from "@lucide/svelte/icons/archive";
	import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";
	import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
	import ChartColumnIcon from "@lucide/svelte/icons/chart-column";
	import ListFilterIcon from "@lucide/svelte/icons/list-filter";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import RepeatIcon from "@lucide/svelte/icons/repeat";
	import SearchIcon from "@lucide/svelte/icons/search";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import Share2Icon from "@lucide/svelte/icons/share-2";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
	import XIcon from "@lucide/svelte/icons/x";
	import { toast } from "svelte-sonner";

	import {
		categoryOf,
		categoryOptions,
		categoryStyle,
	} from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import IconButton from "#lib/components/icon-button.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import LoadedFromHere from "#lib/components/loaded-from-here.svelte";
	import ResponsiveSheet from "#lib/components/responsive-sheet.svelte";
	import SimilarSheet, {
		type SimilarExpense,
	} from "#lib/components/similar-sheet.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { Input } from "#lib/components/ui/input/index.js";
	import { listBlocks } from "#lib/list-blocks.js";
	import { formatMoney } from "#lib/money.js";
	import { offlineQueue } from "#lib/offline-queue.svelte.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast, toastError } from "#lib/toast.js";

	import BalanceHero from "./balance-hero.svelte";
	import ExpenseSheet, { type EditableExpense } from "./expense-sheet.svelte";

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
	let filterOpen = $state(false);
	let similarOpen = $state(false);
	let similar = $state<{
		category: { value: string; label: string };
		expenses: SimilarExpense[];
	}>();

	const filterOptions = $derived(categoryOptions(data.categories));
	const activeCategory = $derived(
		data.category ? categoryOf(data.category, data.categories) : undefined,
	);

	function listHref(
		category: string | null,
		limit?: number,
		search = data.search,
	): string {
		const params = new URLSearchParams();
		if (category) {
			params.set("category", category);
		}
		if (search) {
			params.set("q", search);
		}
		if (limit) {
			params.set("limit", String(limit));
		}
		const query = params.toString();
		return query ? `?${query}` : "?";
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function searchFor(text: string) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void goto(listHref(data.category, undefined, text.trim()), {
				replace: true,
				reset: false,
			});
		}, 300);
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
		{#if data.matching > 0 || activeCategory || data.search}
			<div class="mb-4 flex items-center gap-2">
				<label class="relative min-w-0 flex-1">
					<span class="sr-only">Search expenses</span>
					<SearchIcon
						class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
					/>
					<Input
						type="search"
						value={data.search}
						placeholder="Search"
						autocomplete="off"
						oninput={(event) => searchFor(event.currentTarget.value)}
						class="h-11 rounded-xl pl-9"
					/>
				</label>
				<Button
					variant="secondary"
					class="h-11 max-w-[45%] shrink-0 rounded-xl"
					aria-label={activeCategory
						? `Filtered by ${activeCategory.label}`
						: "Filter by category"}
					onclick={() => (filterOpen = true)}
				>
					{#if activeCategory}
						<span
							class="category-tile flex size-6 shrink-0 items-center justify-center rounded-md"
							style={categoryStyle(activeCategory)}
						>
							<activeCategory.icon class="size-3.5" />
						</span>
						<span class="truncate">{activeCategory.label}</span>
					{:else}
						<ListFilterIcon />
						Filter
					{/if}
				</Button>
				{#if activeCategory}
					<IconButton
						label="Show every category"
						icon={XIcon}
						href={listHref(null)}
						data-sveltekit-reset="false"
					/>
				{/if}
			</div>
			{#if activeCategory || data.search}
				<p class="text-muted-foreground mb-3 px-1 text-sm">
					{data.matching}
					{data.matching === 1 ? "expense" : "expenses"}
				</p>
			{/if}
		{/if}
		{#if data.expenses.length === 0 && (activeCategory || data.search)}
			<EmptyState
				icon={activeCategory?.icon ?? SearchIcon}
				title="No expense matches"
				subtitle={data.search
					? `Nothing with "${data.search}"${activeCategory ? ` under ${activeCategory.label}` : ""}.`
					: `No expense is filed under ${activeCategory?.label}.`}
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
							href={listHref(
								data.category,
								data.expenses.length + data.pageSize,
							)}
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

<ResponsiveSheet bind:open={filterOpen} title="Filter by category">
	<ul class="flex flex-col gap-1 pb-4" aria-label="Categories">
		<li>
			<a
				href={listHref(null)}
				data-sveltekit-reset="false"
				onclick={() => (filterOpen = false)}
				class="hover:bg-muted flex min-h-12 items-center gap-3 rounded-xl px-2 {data.category
					? ''
					: 'bg-muted font-medium'}"
			>
				<span
					class="category-tile flex size-9 items-center justify-center rounded-lg"
					style="--category-chroma: 0"
				>
					<ListFilterIcon class="size-4" />
				</span>
				Every category
			</a>
		</li>
		{#each filterOptions as option (option.value)}
			<li>
				<a
					href={listHref(option.value)}
					data-sveltekit-reset="false"
					onclick={() => (filterOpen = false)}
					class="hover:bg-muted flex min-h-12 items-center gap-3 rounded-xl px-2 {data.category ===
					option.value
						? 'bg-muted font-medium'
						: ''}"
				>
					<span
						class="category-tile flex size-9 items-center justify-center rounded-lg"
						style={categoryStyle(option)}
					>
						<option.icon class="size-4" />
					</span>
					{option.label}
				</a>
			</li>
		{/each}
	</ul>
</ResponsiveSheet>

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
