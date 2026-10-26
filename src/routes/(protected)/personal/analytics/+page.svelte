<script lang="ts">
	import { resolve } from "$app/paths";
	import PiggyBankIcon from "@lucide/svelte/icons/piggy-bank";
	import ReceiptIcon from "@lucide/svelte/icons/receipt";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import { periodLabels, periods } from "#lib/analytics.js";
	import { categoryOf, categoryStyle } from "#lib/categories.js";
	import BarList from "#lib/components/bar-list.svelte";
	import SpendingChart from "#lib/components/spending-chart.svelte";
	import StatCard from "#lib/components/stat-card.svelte";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	setPageTitle("Insights", resolve("/(protected)/personal"));

	const folderNames = $derived(
		new Map(data.folders.map((folder) => [folder.id, folder.name])),
	);
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
		label="Spent"
		icon={WalletIcon}
		value={formatMoney(data.summary.totalMinor, data.currency)}
	/>
	<StatCard
		label="Set aside"
		icon={PiggyBankIcon}
		value={formatMoney(data.asideMinor, data.currency)}
	/>
	<StatCard label="Expenses" icon={ReceiptIcon} value={data.summary.count} />
</div>

{#if data.otherCurrencies}
	<p class="text-muted-foreground mt-3 px-1 text-sm">
		Only what you spent in {data.currency}, your main currency.
	</p>
{/if}

<SpendingChart
	overTime={data.summary.overTime}
	bucket={data.summary.bucket}
	totalMinor={data.summary.totalMinor}
	currency={data.currency}
/>

<div class="mt-4 grid gap-4 md:mt-6 lg:grid-cols-2 md:gap-6">
	<BarList
		title="By category"
		currency={data.currency}
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
		title="By folder"
		currency={data.currency}
		empty="Nothing in a folder in this period."
		rows={data.summary.byMerchant.map((row) => ({
			...row,
			label: folderNames.get(row.key) ?? "Unknown",
		}))}
	/>
</div>
