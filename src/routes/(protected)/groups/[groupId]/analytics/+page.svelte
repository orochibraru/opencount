<script lang="ts">
	import { resolve } from "$app/paths";
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import UserRoundIcon from "@lucide/svelte/icons/user-round";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import { type Bucket, periodLabels, periods } from "#lib/analytics.js";
	import { categoryOf, categoryStyle } from "#lib/categories.js";
	import StatCard from "#lib/components/stat-card.svelte";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";
	import { cn } from "#lib/utils.js";

	import BarList from "./bar-list.svelte";

	const { data } = $props();

	const groupHref = $derived(
		resolve("/(protected)/groups/[groupId]", { groupId: data.group.id }),
	);

	setPageTitle("Insights", () => groupHref);

	const names = $derived(
		new Map(data.members.map((member) => [member.id, member.displayName])),
	);
	const merchantNames = $derived(
		new Map(data.merchants.map((merchant) => [merchant.id, merchant.name])),
	);
	const largest = $derived(
		Math.max(1, ...data.summary.overTime.map((entry) => entry.totalMinor)),
	);
	const average = $derived(
		data.summary.overTime.length > 0
			? Math.round(data.summary.totalMinor / data.summary.overTime.length)
			: 0,
	);

	const bucketNames: Record<Bucket, string> = {
		day: "day",
		week: "week",
		month: "month",
	};

	function bucketLabel(key: string, bucket: Bucket, long = false): string {
		const date = new Date(`${bucket === "month" ? `${key}-01` : key}T12:00:00`);
		if (bucket === "month") {
			return date.toLocaleDateString(undefined, {
				month: long ? "long" : "short",
				year: long ? "numeric" : undefined,
			});
		}
		const day = date.toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
		});
		return bucket === "week" && long ? `Week of ${day}` : day;
	}

	function showTick(index: number, count: number): boolean {
		const step = Math.ceil(count / 8);
		return index % step === 0 || index === count - 1;
	}
</script>

<nav
	class="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
	aria-label="Period"
>
	{#each periods as period (period)}
		<a
			href="?period={period}"
			aria-current={data.period === period ? "page" : undefined}
			data-sveltekit-reset="false"
			data-sveltekit-replacestate
			class="border-border text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors"
		>
			{periodLabels[period]}
		</a>
	{/each}
</nav>

<div class="grid gap-3 sm:grid-cols-3 md:gap-4">
	<StatCard
		label="Spent together"
		icon={WalletIcon}
		value={formatMoney(data.summary.totalMinor, data.group.currency)}
	/>
	<StatCard
		label="Your share"
		icon={UserRoundIcon}
		value={formatMoney(data.summary.myShareMinor, data.group.currency)}
	/>
	<StatCard label="Expenses" icon={ReceiptIcon} value={data.summary.count} />
</div>

<section class="glass mt-4 flex flex-col gap-4 rounded-2xl p-4 md:mt-6 md:p-5">
	<div class="flex items-baseline justify-between gap-3">
		<h2 class="font-semibold">Over time</h2>
		<p class="text-muted-foreground text-sm">
			{formatMoney(average, data.group.currency)} per {bucketNames[
				data.summary.bucket
			]} on average
		</p>
	</div>
	<div class="flex h-48 items-end gap-0.5 md:h-56" role="presentation">
		{#each data.summary.overTime as entry (entry.key)}
			<div class="group relative flex h-full min-w-0 flex-1 items-end">
				<div
					class={cn(
						"w-full rounded-t-sm transition-colors",
						entry.totalMinor > 0
							? "bg-primary group-hover:bg-primary/80"
							: "bg-muted",
					)}
					style="height: {entry.totalMinor > 0
						? Math.max(2, (entry.totalMinor / largest) * 100)
						: 1}%"
				></div>
				<div
					class="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md group-hover:block"
				>
					<span class="text-muted-foreground block"
						>{bucketLabel(entry.key, data.summary.bucket, true)}</span
					>
					<span class="font-medium tabular"
						>{formatMoney(entry.totalMinor, data.group.currency)}</span
					>
				</div>
			</div>
		{/each}
	</div>
	<div
		class="text-muted-foreground -mt-2 flex gap-0.5 text-[0.7rem]"
		aria-hidden="true"
	>
		{#each data.summary.overTime as entry, index (entry.key)}
			<span
				class="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap"
				>{showTick(index, data.summary.overTime.length)
					? bucketLabel(entry.key, data.summary.bucket)
					: ""}</span
			>
		{/each}
	</div>
	<table class="sr-only">
		<caption>Spending per {bucketNames[data.summary.bucket]}</caption>
		<tbody>
			{#each data.summary.overTime as entry (entry.key)}
				<tr>
					<th scope="row"
						>{bucketLabel(entry.key, data.summary.bucket, true)}</th
					>
					<td>{formatMoney(entry.totalMinor, data.group.currency)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<div class="mt-4 grid gap-4 md:mt-6 lg:grid-cols-3 md:gap-6">
	<BarList
		title="By category"
		currency={data.group.currency}
		empty="Nothing spent in this period."
		rows={data.summary.byCategory.map((row) => {
			const category = categoryOf(row.key, data.categories);
			return {
				...row,
				label: category.label,
				icon: category.icon,
				colour: categoryStyle(category),
			};
		})}
	/>
	<BarList
		title="By merchant"
		currency={data.group.currency}
		empty="No merchant on these expenses yet. Pick one under Where when adding an expense."
		rows={data.summary.byMerchant.map((row) => ({
			...row,
			label: merchantNames.get(row.key) ?? "Unknown",
		}))}
	/>
	<BarList
		title="Who paid"
		currency={data.group.currency}
		empty="Nothing spent in this period."
		rows={data.summary.byPayer.map((row) => ({
			...row,
			label: names.get(row.key) ?? "Someone",
		}))}
	/>
</div>
