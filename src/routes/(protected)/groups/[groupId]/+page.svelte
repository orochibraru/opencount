<script lang="ts">
	import { enhance } from "$app/forms";
	import { resolve } from "$app/paths";
	import ArchiveIcon from "@lucide/svelte/icons/archive";
	import ArchiveRestoreIcon from "@lucide/svelte/icons/archive-restore";
	import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
	import ChartColumnIcon from "@lucide/svelte/icons/chart-column";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import RepeatIcon from "@lucide/svelte/icons/repeat";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";

	import { categoryOf } from "#lib/categories.js";
	import EmptyState from "#lib/components/empty-state.svelte";
	import Fab from "#lib/components/fab.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import { Button } from "#lib/components/ui/button/index.js";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { enhanceToast } from "#lib/toast.js";

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
		],
	);

	let sheetOpen = $state(false);
	let editing = $state<EditableExpense | undefined>();

	const names = $derived(
		new Map(data.members.map((member) => [member.id, member.displayName])),
	);
	const merchantNames = $derived(
		new Map(data.merchants.map((merchant) => [merchant.id, merchant.name])),
	);
	const days = $derived.by(() => {
		const grouped = new Map<string, typeof data.expenses>();
		for (const entry of data.expenses) {
			grouped.set(entry.spentOn, [
				...(grouped.get(entry.spentOn) ?? []),
				entry,
			]);
		}
		return [...grouped];
	});
	const totalSpent = $derived(
		data.expenses
			.filter((entry) => entry.kind === "expense")
			.reduce((sum, entry) => sum + entry.amountMinor, 0),
	);

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

<div class="grid gap-6 xl:grid-cols-[minmax(20rem,26rem)_1fr] xl:items-start">
	<div class="flex flex-col gap-4 xl:sticky xl:top-24">
		<BalanceHero
			balanceMinor={data.myMemberId ? (data.balances[data.myMemberId] ?? 0) : 0}
			totalSpentMinor={totalSpent}
			currency={data.group.currency}
			memberCount={data.members.length}
			balancesHref={resolve("/(protected)/groups/[groupId]/balances", {
				groupId: data.group.id,
			})}
		/>
	</div>

	<section aria-label="Expenses">
		{#if data.expenses.length === 0}
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
				{#each days as [day, entries] (day)}
					<div>
						<h2 class="text-muted-foreground mb-2 px-1 text-sm font-medium">
							{dayLabel(day)}
						</h2>
						<ul
							class="glass divide-border divide-y overflow-hidden rounded-2xl"
						>
							{#each entries as entry (entry.id)}
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
												class="bg-accent text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-xl"
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
												{#if entry.kind === "expense" && share > 0}
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
			</div>
		{/if}
	</section>
</div>

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
/>
