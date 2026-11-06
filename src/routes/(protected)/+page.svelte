<script lang="ts">
	import { resolve } from "$app/paths";
	import WalletIcon from "@lucide/svelte/icons/wallet";

	import LeftUntilPayday from "#lib/components/home/left-until-payday.svelte";
	import MoneyOverview from "#lib/components/home/money-overview.svelte";
	import AccountsCard from "#lib/components/money/accounts-card.svelte";
	import { setPageTitle } from "#lib/page-title.svelte.js";

	const { data } = $props();

	setPageTitle("Home", undefined, [
		{
			label: "Personal",
			icon: WalletIcon,
			href: resolve("/(protected)/personal"),
		},
	]);
</script>

<div
	class="mb-4 grid grid-cols-1 gap-4 md:mb-6 md:gap-6 lg:grid-cols-3 lg:items-start"
>
	{#if data.accounts.length > 0}
		<div class="min-w-0 lg:col-span-2">
			<AccountsCard accounts={data.accounts} currency={data.currency} />
		</div>
	{/if}
	{#if data.left}
		<LeftUntilPayday
			parts={data.left.parts}
			included={data.left.included}
			incomeMinor={data.left.incomeMinor}
			since={data.left.since}
		/>
	{/if}
</div>
<MoneyOverview overview={data.overview} />
