<script lang="ts">
	import { resolve } from "$app/paths";
	import ChartLineIcon from "@lucide/svelte/icons/chart-line";
	import HandCoinsIcon from "@lucide/svelte/icons/hand-coins";
	import LandmarkIcon from "@lucide/svelte/icons/landmark";
	import PiggyBankIcon from "@lucide/svelte/icons/piggy-bank";
	import UsersIcon from "@lucide/svelte/icons/users";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import { type Period, periodLabels, periods } from "#lib/analytics.js";
	import {
		categoryOf,
		categoryOptions,
		categoryStyle,
	} from "#lib/categories.js";
	import BarList from "#lib/components/bar-list.svelte";
	import ItemMenu from "#lib/components/item-menu.svelte";
	import ListFilters, {
		type FilterChange,
		type FilterSource,
	} from "#lib/components/list-filters.svelte";
	import SpendingChart from "#lib/components/spending-chart.svelte";
	import StatCard from "#lib/components/stat-card.svelte";
	import { formatMoney } from "#lib/money.js";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	setPageTitle("Insights", resolve("/(protected)/personal"));

	function accountFlag(
		account: (typeof data.accounts)[number],
		flag: "shared" | "savings",
		value: boolean,
	) {
		return {
			action: "?/setAccount",
			fields: {
				connectionId: account.connectionId,
				uid: account.uid,
				flag,
				value: String(value),
			},
			loading: "Saving",
			success: "Saved.",
		};
	}

	const sources = $derived<FilterSource[]>(
		data.accounts.length < 2
			? []
			: [...new Set(data.accounts.map((entry) => entry.connectionId))].flatMap(
					(connectionId) => {
						const own = data.accounts.filter(
							(entry) => entry.connectionId === connectionId,
						);
						return [
							{
								value: `bank:${connectionId}`,
								label: own[0]?.bankName ?? "Bank",
							},
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
		data.filter.account
			? `account:${data.filter.account}`
			: data.filter.bank
				? `bank:${data.filter.bank}`
				: null,
	);
	const folderOptions = $derived(
		data.folders.map((entry) => ({ value: entry.id, label: entry.name })),
	);

	function insightsHref(change: FilterChange & { period?: Period }): string {
		const params = new URLSearchParams();
		const period = change.period ?? data.period;
		const category =
			change.category === undefined ? data.filter.category : change.category;
		const folder =
			change.folder === undefined ? data.filter.folder : change.folder;
		const source = change.source === undefined ? currentSource : change.source;
		const search = change.search ?? data.filter.search;
		if (period !== "month") {
			params.set("period", period);
		}
		if (category) {
			params.set("category", category);
		}
		if (folder) {
			params.set("folder", folder);
		}
		if (source?.startsWith("bank:")) {
			params.set("bank", source.slice(5));
		} else if (source?.startsWith("account:")) {
			params.set("account", source.slice(8));
		}
		if (search) {
			params.set("q", search);
		}
		const query = params.toString();
		return query ? `?${query}` : "?";
	}

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
			href={insightsHref({ period })}
			aria-current={data.period === period ? "page" : undefined}
			data-sveltekit-reset="false"
			data-sveltekit-replacestate
			class="border-border text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors"
		>
			{periodLabels[period]}
		</a>
	{/each}
</nav>

<ListFilters
	search={data.filter.search}
	active={data.filter.category
		? categoryOf(data.filter.category, data.categories)
		: undefined}
	options={categoryOptions(data.categories)}
	{sources}
	activeSource={sources.find((source) => source.value === currentSource)}
	folders={folderOptions}
	activeFolder={folderOptions.find(
		(entry) => entry.value === data.filter.folder,
	)}
	href={insightsHref}
/>

<div class="grid gap-3 sm:grid-cols-3 md:gap-4">
	<StatCard
		label="Spent"
		icon={WalletIcon}
		value={formatMoney(data.summary.totalMinor, data.currency)}
		hint="{data.summary.count} expenses"
	/>
	<StatCard
		label="Income"
		icon={HandCoinsIcon}
		value={formatMoney(data.incomeMinor, data.currency)}
		tone="positive"
	/>
	<StatCard
		label="Set aside"
		icon={PiggyBankIcon}
		value={formatMoney(data.asideMinor, data.currency)}
	/>
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

{#if data.accounts.length > 0}
	<div class="mt-4 grid gap-4 md:mt-6 lg:grid-cols-2 md:gap-6">
		<div class="grid content-start gap-3 sm:grid-cols-2 md:gap-4">
			<StatCard
				label="Available now"
				icon={LandmarkIcon}
				value={formatMoney(data.availableMinor, data.currency)}
				hint="Your everyday accounts, half of shared ones"
			/>
			<StatCard
				label="Invested or set aside"
				icon={ChartLineIcon}
				value={formatMoney(data.investedMinor, data.currency)}
				hint="Savings and investment accounts"
			/>
		</div>
		<section class="glass flex flex-col gap-2 rounded-2xl p-4 md:p-5">
			<h2 class="font-semibold">Accounts</h2>
			<p class="text-muted-foreground text-sm">
				Money moved between your accounts is an internal transfer, left out of
				spent and income. A shared account counts at half; money into savings
				counts as set aside.
			</p>
			<ul class="divide-border -mx-1 divide-y" aria-label="Accounts">
				{#each data.accounts as account (account.uid)}
					<li>
						<ItemMenu
							title={account.name}
							class="min-h-14 px-1 py-2"
							actions={[
								{
									label: account.shared
										? "Not shared"
										: "Shared with someone: counts half",
									icon: UsersIcon,
									form: accountFlag(account, "shared", !account.shared),
								},
								{
									label: account.savings
										? "Everyday account"
										: "Savings or investments",
									icon: PiggyBankIcon,
									form: accountFlag(account, "savings", !account.savings),
								},
							]}
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-medium">{account.name}</span>
								<span class="text-muted-foreground block truncate text-sm">
									{[
										account.bankName,
										account.shared ? "Shared, counts half" : null,
										account.savings ? "Savings or investments" : null,
									]
										.filter(Boolean)
										.join(" · ")}
								</span>
							</span>
							<span class="tabular shrink-0 font-medium">
								{account.balance
									? formatMoney(account.balance.minor, account.balance.currency)
									: "–"}
							</span>
						</ItemMenu>
					</li>
				{/each}
			</ul>
		</section>
	</div>
{/if}
