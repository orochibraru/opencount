<script lang="ts">
	import { resolve } from "$app/paths";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import RepeatIcon from "@lucide/svelte/icons/repeat";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";

	import EmptyState from "#lib/components/empty-state.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import RecurringSheet from "#lib/components/personal/recurring-sheet.svelte";
	import { formatFlow, formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import {
		cadenceLabel,
		monthlyCost,
		recurringTypeLabels,
	} from "#lib/recurring-schedule.js";

	const { data } = $props();

	setPageTitle("Recurring", resolve("/(protected)/personal"));

	type Payment = (typeof data.payments)[number];

	let editing = $state<Payment>();
	let sheetOpen = $state(false);
	let endedOpen = $state(false);

	const active = $derived(data.payments.filter((payment) => !payment.ended));
	const ended = $derived(data.payments.filter((payment) => payment.ended));
	const currency = $derived(active[0]?.currency ?? "EUR");
	const perMonth = $derived(
		active
			.filter(
				(payment) =>
					payment.kind === "expense" && payment.currency === currency,
			)
			.reduce((total, payment) => total + monthlyCost(payment), 0),
	);
	const accountNames = $derived(
		new Map(data.accounts.map((account) => [account.id, account.name])),
	);

	function day(iso: string): string {
		return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
		});
	}

	function detail(payment: Payment): string {
		const today = new Date().toISOString().slice(0, 10);
		return [
			payment.nextOn
				? `${payment.nextOn < today ? "Expected" : "Next"} ${day(payment.nextOn)}`
				: payment.lastOn
					? `Last ${day(payment.lastOn)}`
					: null,
			payment.remaining ? `${payment.remaining} left` : null,
			cadenceLabel(payment),
			recurringTypeLabels[payment.type],
			accountNames.get(payment.accountUid ?? ""),
		]
			.filter(Boolean)
			.join(" · ");
	}
</script>

{#snippet row(payment: Payment)}
	<li>
		<ItemMenu
			title={payment.label}
			class="min-h-16 px-3 py-2 md:px-4"
			actions={[
				{
					label: "Edit",
					icon: PencilIcon,
					onSelect: () => {
						editing = payment;
						sheetOpen = true;
					},
				},
				{
					label: "Delete the series",
					icon: Trash2Icon,
					destructive: true,
					form: {
						action: "?/remove",
						fields: { seriesId: payment.id },
						loading: "Deleting the series",
						success: "Series deleted, its payments stay.",
						confirm: {
							title: `Delete "${payment.label}"?`,
							description:
								"Its payments stay in your ledger, just not as recurring.",
							confirmLabel: "Delete",
						},
					},
				},
			]}
		>
			<span
				class="category-tile flex size-11 shrink-0 items-center justify-center rounded-xl"
				style="--category-chroma: 0"
			>
				<RepeatIcon class="size-5" />
			</span>
			<span class="min-w-0 flex-1">
				<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
					<span class="max-w-full truncate font-medium">{payment.label}</span>
					{#if payment.duplicate}
						<span
							class="bg-negative/15 text-negative inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
						>
							<CopyIcon class="size-3" />
							Charged twice
						</span>
					{/if}
				</span>
				<span class="text-muted-foreground line-clamp-2 block text-sm"
					>{detail(payment)}</span
				>
			</span>
			<span
				class="font-display shrink-0 font-semibold tabular {payment.kind ===
				'income'
					? 'text-positive'
					: ''}"
				>{formatFlow(
					payment.amountMinor,
					payment.currency,
					payment.kind === "income",
				)}</span
			>
		</ItemMenu>
	</li>
{/snippet}

<div class="flex flex-col gap-4 px-4 md:max-w-2xl md:px-6">
	{#if data.payments.length === 0}
		<EmptyState
			icon={RepeatIcon}
			title="Nothing recurring yet"
			subtitle="Open a subscription, a loan payment or an instalment in Personal and pick Mark as recurring. Lines like it, synced later too, join it."
		/>
	{:else}
		<section class="glass rounded-2xl p-4 md:p-6" aria-label="Every month">
			<p class="text-muted-foreground text-sm">Every month</p>
			<p class="font-display mt-1 text-3xl font-semibold tabular">
				{formatMoney(perMonth, currency)}
			</p>
			<p class="text-muted-foreground mt-1 text-sm">
				{active.length}
				series going, yearly and weekly ones scaled to a month
			</p>
		</section>
		<ul
			class="glass divide-border divide-y overflow-hidden rounded-2xl"
			aria-label="Recurring payments"
		>
			{#each active as payment (payment.id)}
				{@render row(payment)}
			{/each}
		</ul>
		{#if ended.length > 0}
			<details bind:open={endedOpen} class="flex flex-col gap-2">
				<summary
					class="text-muted-foreground flex min-h-11 cursor-pointer items-center px-1 text-sm font-medium"
				>
					Ended ({ended.length})
				</summary>
				<ul
					class="glass divide-border divide-y overflow-hidden rounded-2xl"
					aria-label="Ended"
				>
					{#each ended as payment (payment.id)}
						{@render row(payment)}
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</div>

{#if editing}
	<RecurringSheet
		bind:open={sheetOpen}
		target={{ seriesId: editing.id }}
		series={data.series}
		action=""
	/>
{/if}
